import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking,
  ActivityIndicator, Alert, Share, Image, TextInput, Modal, FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';
import { fetchRestaurantDetail, fetchAppReviews, createReview } from '../../services/restaurants';
import { addFavorite, removeFavorite } from '../../services/favorites';
import { useFavoriteStore } from '../../store/favoriteStore';
import { useAuthStore } from '../../store/authStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { useCollectionStore } from '../../store/collectionStore';
import { recordRating } from '../../services/social';
import { getMyCollections, addToCollection, createCollection } from '../../services/collections';
import { getClosingInfo } from '../../utils/closingTime';
import StarRating from '../../components/StarRating';
import PhotoGallery from '../../components/PhotoGallery';
import type { RestaurantDetail, AppReview, Collection } from '../../types';
import { formatDistance } from '../../utils/haversine';
import NotificationBell from '../../components/NotificationBell';

const PRICE_MAP: Record<number, string> = { 1: '₺', 2: '₺₺', 3: '₺₺₺', 4: '₺₺₺₺' };

function computeIsOpenFromOverride(override: Record<string, { open: string; close: string; closed: boolean }>): boolean {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const day = override[days[new Date().getDay()]];
  if (!day) return false;
  if (day.closed) return false;
  const [oh, om] = (day.open || '00:00').split(':').map(Number);
  const [ch, cm] = (day.close || '00:00').split(':').map(Number);
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const open = oh * 60 + om;
  const close = ch * 60 + cm;
  if (close <= open) return cur >= open || cur < close;
  return cur >= open && cur < close;
}

export default function RestaurantDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { placeId } = route.params;

  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [appReviews, setAppReviews] = useState<AppReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'google' | 'app'>('google');

  // Quick rating state
  const [quickRating, setQuickRating] = useState(0);
  const [quickRatingDone, setQuickRatingDone] = useState(false);

  // Review modal state
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Koleksiyona ekle modal
  const [collectionModalVisible, setCollectionModalVisible] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  // Yeni koleksiyon oluşturma (inline)
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [newCollName, setNewCollName] = useState('');
  const [creatingColl, setCreatingColl] = useState(false);

  // Menü resmi tam ekran görüntüleyici
  const [selectedMenuImage, setSelectedMenuImage] = useState<string | null>(null);

  const { isFavorite, addFavorite: storeFav, removeFavorite: storeRemoveFav } = useFavoriteStore();
  const { isPremium, user } = useAuthStore();
  const { addStarEvent } = useUserProfileStore();
  const { myCollections, setMyCollections } = useCollectionStore();

  const favorited = isFavorite(placeId);

  useEffect(() => {
    (async () => {
      try {
        const [d, reviews, savedRating] = await Promise.all([
          fetchRestaurantDetail(placeId),
          fetchAppReviews(placeId),
          AsyncStorage.getItem(`quick_rating:${placeId}`),
        ]);
        setDetail(d);
        setAppReviews(reviews);
        if (savedRating) {
          setQuickRating(parseInt(savedRating, 10));
          setQuickRatingDone(true);
        }
      } catch (err: any) {
        Alert.alert('Hata', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [placeId]);

  async function toggleFavorite() {
    if (!detail) return;
    try {
      if (favorited) {
        await removeFavorite(placeId);
        storeRemoveFav(placeId);
      } else {
        const fav = await addFavorite(detail);
        storeFav(fav);
      }
    } catch (err: any) {
      if (err.response?.data?.code === 'PREMIUM_REQUIRED') {
        navigation.navigate('Paywall', { trigger: 'favorites' });
      } else {
        Alert.alert('Hata', err.message);
      }
    }
  }

  async function handleQuickRating(stars: number) {
    if (quickRatingDone || !detail) return;
    setQuickRating(stars);
    setQuickRatingDone(true);
    try {
      await AsyncStorage.setItem(`quick_rating:${placeId}`, String(stars));
      const { starEvent } = await recordRating(detail.placeId, detail.name);
      addStarEvent(starEvent);
      Alert.alert('Teşekkürler! +2 ⭐', 'Puanın kaydedildi.');
    } catch {
      // rate-limited or network error — silent fail, UI already updated
    }
  }

  async function handleSubmitReview() {
    if (!reviewBody.trim()) {
      Alert.alert('Hata', 'Yorum metni boş olamaz.');
      return;
    }
    setSubmittingReview(true);
    try {
      const { review, starEvent } = await createReview(placeId, reviewRating, reviewBody.trim(), detail?.name ?? '');
      setAppReviews(prev => [review, ...prev]);
      if (starEvent) addStarEvent(starEvent);
      setReviewModalVisible(false);
      setReviewBody('');
      setReviewRating(5);
      Alert.alert(
        starEvent ? 'Yorum Eklendi! +5 ⭐' : 'Yorum Güncellendi',
        starEvent ? 'Yorumun için yıldız kazandın!' : 'Yorumun güncellendi.',
      );
    } catch (err: any) {
      Alert.alert('Hata', err.message ?? 'Yorum gönderilemedi.');
    } finally {
      setSubmittingReview(false);
    }
  }

  function handleDirections() {
    if (!detail?.location) return;
    const { lat, lng } = detail.location;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() => Alert.alert('Hata', 'Harita uygulaması açılamadı.'));
  }

  async function handleShare() {
    if (!detail) return;
    try {
      const address = detail.formattedAddress ?? '';
      const rating = detail.rating != null ? `★ ${detail.rating}` : '';
      await Share.share({
        title: detail.name,
        message: `${detail.name}${rating ? ' — ' + rating : ''}${address ? '\n' + address : ''}\nNearEat'ten keşfet!`,
      });
    } catch {
      Alert.alert('Hata', 'Paylaşım açılamadı.');
    }
  }

  function handleRecommend() {
    if (!detail) return;
    navigation.navigate('SendRecommendation', {
      placeId: detail.placeId,
      placeName: detail.name,
      photoUrl: detail.photoUrl,
      rating: detail.rating,
    });
  }

  async function handleOpenCollectionModal() {
    if (!isPremium()) {
      navigation.navigate('Paywall', { trigger: 'collections' });
      return;
    }
    setCollectionModalVisible(true);
    if (myCollections.length === 0) {
      setLoadingCollections(true);
      try {
        const cols = await getMyCollections();
        setMyCollections(cols);
        setCollections(cols);
      } catch { /* swallow */ } finally {
        setLoadingCollections(false);
      }
    } else {
      setCollections(myCollections);
    }
  }

  async function handleAddToCollection(col: Collection) {
    if (!detail) return;
    try {
      await addToCollection(col.id, {
        placeId: detail.placeId,
        placeName: detail.name,
        placeAddress: detail.formattedAddress,
        placePhotoUrl: detail.photos[0] ?? null,
        placeRating: detail.rating,
      });
      setCollectionModalVisible(false);
      Alert.alert('Eklendi!', `"${detail.name}", "${col.name}" koleksiyonuna eklendi.`);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Eklenemedi.');
    }
  }

  async function handleCreateAndAdd() {
    if (!newCollName.trim() || !detail) return;
    setCreatingColl(true);
    try {
      const col = await createCollection({ name: newCollName.trim(), isPublic: false });
      await addToCollection(col.id, {
        placeId: detail.placeId,
        placeName: detail.name,
        placeAddress: detail.formattedAddress,
        placePhotoUrl: detail.photos[0] ?? null,
        placeRating: detail.rating,
      });
      setMyCollections([...myCollections, { ...col, itemCount: 1 }]);
      setCollectionModalVisible(false);
      setShowInlineCreate(false);
      setNewCollName('');
      Alert.alert('Oluşturuldu!', `"${col.name}" listesi oluşturuldu ve "${detail.name}" eklendi.`);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Liste oluşturulamadı.');
    } finally {
      setCreatingColl(false);
    }
  }

  function renderAppReviews() {
    return (
      <>
        <TouchableOpacity
          style={styles.writeReviewBtn}
          onPress={() => setReviewModalVisible(true)}
        >
          <Text style={styles.writeReviewText}>✍️ Yorum Yaz  (+5 ⭐)</Text>
        </TouchableOpacity>
        {appReviews.length === 0
          ? <Text style={styles.emptyText}>Henüz yorum yok. İlk sen yaz!</Text>
          : appReviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                {r.user.photoUrl
                  ? <Image source={{ uri: r.user.photoUrl }} style={styles.reviewAvatar} />
                  : (
                    <View style={styles.reviewAvatarPlaceholder}>
                      <Text style={{ fontSize: 12 }}>{r.user.displayName.charAt(0)}</Text>
                    </View>
                  )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewAuthor}>{r.user.displayName}</Text>
                  <StarRating rating={r.rating} size={12} />
                </View>
              </View>
              <Text style={styles.reviewBody}>{r.body}</Text>
              {r.reply && (
                <View style={styles.replyBox}>
                  <Text style={styles.replyLabel}>🏪 {r.reply.restaurant?.businessName ?? 'İşletme Yanıtı'}</Text>
                  <Text style={styles.replyContent}>{r.reply.content}</Text>
                </View>
              )}
            </View>
          ))}
      </>
    );
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#FF6B35" />;
  }

  if (!detail) return null;

  const today = new Date().getDay();
  const effectiveOpenNow = detail.openingHoursOverride
    ? computeIsOpenFromOverride(detail.openingHoursOverride)
    : (detail.openingHours?.open_now ?? null);
  const effectiveOpeningHours = detail.openingHours
    ? { ...detail.openingHours, open_now: effectiveOpenNow ?? detail.openingHours.open_now }
    : null;
  const closingInfo = getClosingInfo(effectiveOpeningHours);
  const HOURS_DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const HOURS_DAY_LABELS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  const todayOverrideIdx = (today + 6) % 7;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <PhotoGallery photos={detail.photos} />

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{detail.name}</Text>
              <Text style={styles.meta}>
                {[
                  PRICE_MAP[detail.priceLevel ?? 0],
                  detail.distanceKm != null ? formatDistance(detail.distanceKm) : undefined,
                ].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
            <TouchableOpacity onPress={toggleFavorite} style={styles.favoriteBtn}>
              <Text style={styles.heartIcon}>{favorited ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.ratingRow}>
            <StarRating rating={detail.rating} />
            <Text style={styles.ratingText}>{detail.rating} ({detail.userRatingsTotal} oy)</Text>
            {(detail.openingHours || detail.openingHoursOverride) && (
              <View style={[
                styles.openBadge,
                closingInfo.closingVerySoon ? styles.openBadgeClosingVery :
                closingInfo.closingSoon ? styles.openBadgeClosingSoon :
                effectiveOpenNow ? styles.openBadgeOpen : styles.openBadgeClosed,
              ]}>
                <Text style={styles.openBadgeText}>
                  {closingInfo.closingVerySoon
                    ? `⚠️ ${closingInfo.minutesUntilClose} dk'da kapanıyor!`
                    : closingInfo.closingSoon
                    ? `🕐 ${closingInfo.minutesUntilClose} dk'da kapanıyor`
                    : effectiveOpenNow ? 'Açık' : 'Kapalı'}
                </Text>
              </View>
            )}
          </View>

          {/* Duyuru banner */}
          {detail.announcement && (
            <View style={styles.announcementBanner}>
              <Text style={styles.announcementBannerText}>📢 {detail.announcement}</Text>
            </View>
          )}

          {/* İndirim banner */}
          {detail.discount && (detail.discount.instantActive || detail.discount.starDiscountEnabled) && (
            <View style={[styles.discountBanner, detail.discount.instantActive ? styles.discountBannerInstant : styles.discountBannerStar]}>
              {detail.discount.instantActive && detail.discount.instantPercent != null && (
                <Text style={styles.discountBannerText}>
                  ⚡ Anlık İndirim: %{detail.discount.instantPercent} — Bugün geçerli!
                </Text>
              )}
              {detail.discount.starDiscountPercent != null && (
                <Text style={styles.discountBannerText}>
                  ⭐ Yıldız seviyenize özel: %{detail.discount.starDiscountPercent} indirim
                </Text>
              )}
              {!detail.discount.starDiscountPercent && detail.discount.starDiscountEnabled && !detail.discount.instantActive && (
                <Text style={styles.discountBannerText}>
                  🌟 Seçili restoran — Yıldız kazanarak indirim kazan!
                </Text>
              )}
              {detail.discount.note && <Text style={styles.discountBannerNote}>{detail.discount.note}</Text>}
            </View>
          )}

          {/* Kapanış yakın uyarı banner */}
          {closingInfo.closingSoon && (
            <View style={[styles.closingBanner, closingInfo.closingVerySoon && styles.closingBannerUrgent]}>
              <Text style={styles.closingBannerText}>
                {closingInfo.closingVerySoon
                  ? `⚠️ Restoran ${closingInfo.minutesUntilClose} dakika içinde kapanıyor! (${closingInfo.closingTimeStr})`
                  : `🕐 Restoran yakında kapanıyor. Kapanış: ${closingInfo.closingTimeStr}`}
              </Text>
            </View>
          )}

          {/* Quick Rating */}
          <View style={styles.quickRatingSection}>
            <Text style={styles.quickRatingLabel}>
              {quickRatingDone ? `Puanın: ${'⭐'.repeat(quickRating)}` : 'Hızlı Puan Ver (+2 ⭐)'}
            </Text>
            <View style={styles.quickStars}>
              {[1, 2, 3, 4, 5].map(s => (
                <TouchableOpacity key={s} onPress={() => handleQuickRating(s)} disabled={quickRatingDone}>
                  <Text style={styles.quickStar}>{s <= quickRating ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleDirections}>
              <Text style={styles.actionBtnText}>🗺️ Yol Tarifi</Text>
            </TouchableOpacity>
            {detail.formattedPhoneNumber && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => Linking.openURL(`tel:${detail.formattedPhoneNumber}`)}
              >
                <Text style={styles.actionBtnText}>📞 Ara</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
              <Text style={styles.actionBtnText}>📤 Paylaş</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.recommendBtn]} onPress={handleRecommend}>
              <Text style={[styles.actionBtnText, styles.recommendBtnText]}>💌 Öner</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.collectionBtn]} onPress={handleOpenCollectionModal}>
              <Text style={[styles.actionBtnText, styles.collectionBtnText]}>📋 Liste</Text>
            </TouchableOpacity>
            {detail.reservationUrl && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.reservationBtn]}
                onPress={() => Linking.openURL(detail.reservationUrl!)}
              >
                <Text style={[styles.actionBtnText, styles.reservationBtnText]}>📅 Rezervasyon</Text>
              </TouchableOpacity>
            )}
          </View>

          {(detail.openingHoursOverride || detail.openingHours?.weekday_text) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Çalışma Saatleri</Text>
              {detail.openingHoursOverride
                ? HOURS_DAY_KEYS.map((key, i) => {
                    const day = detail.openingHoursOverride![key];
                    if (!day) return null;
                    const value = day.closed ? 'Kapalı' : `${day.open} – ${day.close}`;
                    return (
                      <Text key={key} style={[styles.hourLine, i === todayOverrideIdx && styles.todayLine]}>
                        {HOURS_DAY_LABELS[i]}: {value}
                      </Text>
                    );
                  })
                : detail.openingHours!.weekday_text.map((line, i) => (
                    <Text key={i} style={[styles.hourLine, i === today - 1 && styles.todayLine]}>{line}</Text>
                  ))
              }
            </View>
          )}

          {detail.popularTimes ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>En Kalabalık Saatler</Text>
              <Text style={styles.premiumHint}>Bu özellik premium kullanıcılara özeldir.</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.blurSection}
              onPress={() => navigation.navigate('Paywall', { trigger: 'popular_times' })}
            >
              <Text style={styles.blurText}>📊 En Kalabalık Saatler · Premium</Text>
            </TouchableOpacity>
          )}

          {/* Menu section — premium only */}
          {detail.hasMenu && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Menü</Text>
              {isPremium() ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {(detail.menu ?? []).map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.menuThumb}
                      onPress={() => item.data && setSelectedMenuImage(item.data)}
                      activeOpacity={item.data ? 0.8 : 1}
                    >
                      {item.data ? (
                        <Image source={{ uri: item.data }} style={styles.menuThumbImage} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontSize: 28 }}>🖼️</Text>
                      )}
                      <Text style={styles.menuThumbLabel} numberOfLines={1}>{item.fileName ?? 'Menü'}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <TouchableOpacity style={styles.blurSection} onPress={() => navigation.navigate('Paywall', { trigger: 'popular_times' })}>
                  <Text style={styles.blurText}>📋 Menüyü Görüntüle · Premium</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'google' && styles.tabActive]}
              onPress={() => setActiveTab('google')}
            >
              <Text style={[styles.tabText, activeTab === 'google' && styles.tabTextActive]}>Google Yorumları</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'app' && styles.tabActive]}
              onPress={() => setActiveTab('app')}
            >
              <Text style={[styles.tabText, activeTab === 'app' && styles.tabTextActive]}>Uygulama Yorumları</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'google' &&
            detail.googleReviews.map((r, i) => (
              <View key={i} style={styles.reviewCard}>
                <Text style={styles.reviewAuthor}>{r.author_name}</Text>
                <StarRating rating={r.rating} size={12} />
                <Text style={styles.reviewDate}>{r.relative_time_description}</Text>
                <Text style={styles.reviewBody}>{r.text}</Text>
              </View>
            ))}

          {activeTab === 'app' && renderAppReviews()}
        </View>
      </ScrollView>

      {/* Back Button Overlay */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>‹</Text>
      </TouchableOpacity>

      {/* Notification Bell Overlay */}
      <View style={styles.notifBellOverlay}>
        <NotificationBell />
      </View>

      {/* Koleksiyona Ekle Modal */}
      <Modal
        visible={collectionModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCollectionModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setCollectionModalVisible(false); setShowInlineCreate(false); setNewCollName(''); }}>
              <Text style={styles.modalCancel}>İptal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Koleksiyona Ekle</Text>
            <TouchableOpacity onPress={() => { setShowInlineCreate(v => !v); setNewCollName(''); }}>
              <Text style={styles.modalSubmit}>{showInlineCreate ? '× Kapat' : '+ Yeni'}</Text>
            </TouchableOpacity>
          </View>

          {/* Inline yeni koleksiyon oluşturma */}
          {showInlineCreate && (
            <View style={styles.inlineCreate}>
              <TextInput
                style={styles.inlineInput}
                placeholder="Liste adı"
                placeholderTextColor="#9CA3AF"
                value={newCollName}
                onChangeText={setNewCollName}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.inlineCreateBtn, (!newCollName.trim() || creatingColl) && { opacity: 0.5 }]}
                onPress={handleCreateAndAdd}
                disabled={!newCollName.trim() || creatingColl}
              >
                {creatingColl
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.inlineCreateBtnText}>Oluştur ve Ekle</Text>}
              </TouchableOpacity>
            </View>
          )}

          {loadingCollections ? (
            <ActivityIndicator color="#FF6B35" style={{ marginTop: 40 }} />
          ) : collections.length === 0 && !showInlineCreate ? (
            <View style={styles.emptyCollections}>
              <Text style={styles.emptyCollectionsTitle}>Henüz koleksiyon yok</Text>
              <Text style={styles.emptyCollectionsText}>
                "+ Yeni" ile hemen bir liste oluşturup ekleyebilirsin.
              </Text>
            </View>
          ) : (
            <FlatList
              data={collections}
              keyExtractor={(c) => c.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item: col }) => (
                <TouchableOpacity style={styles.collectionRow} onPress={() => handleAddToCollection(col)}>
                  <View style={styles.collectionRowIcon}>
                    <Text style={{ fontSize: 20 }}>📋</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.collectionRowName}>{col.name}</Text>
                    <Text style={styles.collectionRowMeta}>{col.itemCount} restoran</Text>
                  </View>
                  <Text style={styles.collectionRowAdd}>+</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {/* Menü Resmi Tam Ekran Modal */}
      <Modal
        visible={!!selectedMenuImage}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedMenuImage(null)}
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity style={styles.imageViewerClose} onPress={() => setSelectedMenuImage(null)}>
            <Text style={styles.imageViewerCloseText}>✕</Text>
          </TouchableOpacity>
          {selectedMenuImage && (
            <Image
              source={{ uri: selectedMenuImage }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Review Modal */}
      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
              <Text style={styles.modalCancel}>İptal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Yorum Yaz</Text>
            <TouchableOpacity onPress={handleSubmitReview} disabled={submittingReview}>
              {submittingReview
                ? <ActivityIndicator size="small" color="#FF6B35" />
                : <Text style={styles.modalSubmit}>Gönder</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.modalRestaurant}>{detail.name}</Text>

          <View style={styles.modalStarsRow}>
            {[1, 2, 3, 4, 5].map(s => (
              <TouchableOpacity key={s} onPress={() => setReviewRating(s)}>
                <Text style={styles.modalStar}>{s <= reviewRating ? '⭐' : '☆'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.modalInput}
            value={reviewBody}
            onChangeText={setReviewBody}
            placeholder="Deneyiminizi paylaşın..."
            placeholderTextColor="#9CA3AF"
            multiline
            autoFocus
            maxLength={500}
          />

          <View style={styles.starEarnHint}>
            <Text style={styles.starEarnHintText}>✍️ Bu yorumu göndererek +5 ⭐ yıldız kazanacaksın!</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  name: { fontSize: 22, fontWeight: '700', color: '#111827' },
  meta: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  favoriteBtn: { padding: 8 },
  heartIcon: { fontSize: 24 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  ratingText: { fontSize: 14, color: '#374151' },
  openBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  openBadgeOpen: { backgroundColor: '#D1FAE5' },
  openBadgeClosed: { backgroundColor: '#FEE2E2' },
  openBadgeClosingSoon: { backgroundColor: '#FEF3C7' },
  openBadgeClosingVery: { backgroundColor: '#FEE2E2' },
  openBadgeText: { fontSize: 12, fontWeight: '600', color: '#111827' },
  closingBanner: {
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 12,
    marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#F59E0B',
  },
  closingBannerUrgent: { backgroundColor: '#FEF2F2', borderLeftColor: '#EF4444' },
  closingBannerText: { fontSize: 13, fontWeight: '600', color: '#92400E' },
  quickRatingSection: {
    backgroundColor: '#FFFBEB', borderRadius: 12,
    padding: 12, marginBottom: 16, alignItems: 'center',
  },
  quickRatingLabel: { fontSize: 13, color: '#92400E', fontWeight: '600', marginBottom: 8 },
  quickStars: { flexDirection: 'row', gap: 8 },
  quickStar: { fontSize: 26 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  actionBtn: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  recommendBtn: { backgroundColor: '#FFF0EB' },
  recommendBtnText: { color: '#FF6B35' },
  collectionBtn: { backgroundColor: '#F0F4FF' },
  collectionBtnText: { color: '#4F46E5' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  hourLine: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  todayLine: { fontWeight: '700', color: '#111827' },
  premiumHint: { fontSize: 13, color: '#9CA3AF' },
  blurSection: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20 },
  blurText: { fontSize: 15, color: '#FF6B35', fontWeight: '600' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: '#FF6B35' },
  tabText: { fontSize: 14, color: '#9CA3AF' },
  tabTextActive: { color: '#FF6B35', fontWeight: '600' },
  writeReviewBtn: {
    backgroundColor: '#FFF0EB', borderRadius: 12, padding: 14,
    alignItems: 'center', marginBottom: 14,
  },
  writeReviewText: { color: '#FF6B35', fontWeight: '700', fontSize: 15 },
  reviewCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 10 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 10 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16 },
  reviewAvatarPlaceholder: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FFE8DF', alignItems: 'center', justifyContent: 'center',
  },
  reviewAuthor: { fontWeight: '600', color: '#111827', marginBottom: 2 },
  reviewDate: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
  reviewBody: { fontSize: 13, color: '#374151', lineHeight: 20 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 20 },
  paywallHint: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 16, alignItems: 'center' },
  paywallHintText: { color: '#FF6B35', fontWeight: '600' },
  backBtn: {
    position: 'absolute', top: 44, left: 16,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 22,
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  backBtnText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 34 },
  notifBellOverlay: {
    position: 'absolute', top: 44, right: 16,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 22,
    padding: 8, zIndex: 10,
  },
  // Review modal
  modalContainer: { flex: 1, backgroundColor: '#fff', padding: 20 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 16, borderBottomWidth: 1, borderColor: '#F3F4F6',
  },
  modalCancel: { fontSize: 16, color: '#6B7280' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalSubmit: { fontSize: 16, color: '#FF6B35', fontWeight: '700' },
  modalRestaurant: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 12 },
  modalStarsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modalStar: { fontSize: 32 },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#111827', minHeight: 120,
    textAlignVertical: 'top', backgroundColor: '#FAFAFA',
  },
  starEarnHint: {
    backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14,
    alignItems: 'center', marginTop: 16,
  },
  starEarnHintText: { color: '#92400E', fontWeight: '600', fontSize: 14 },
  // Koleksiyon modal stilleri
  emptyCollections: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyCollectionsTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptyCollectionsText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  goCollectionsBtn: {
    backgroundColor: '#FF6B35', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24,
  },
  goCollectionsBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  collectionRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  collectionRowIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0F4FF',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  collectionRowName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  collectionRowMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  collectionRowAdd: { fontSize: 22, color: '#4F46E5', fontWeight: '700', paddingLeft: 8 },
  // Announcement & discount banners
  announcementBanner: { backgroundColor: '#EEF2FF', borderRadius: 10, padding: 10, marginBottom: 10 },
  announcementBannerText: { fontSize: 13, color: '#4F46E5', fontWeight: '600' },
  discountBanner: { borderRadius: 10, padding: 12, marginBottom: 12 },
  discountBannerInstant: { backgroundColor: '#FFFBEB', borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  discountBannerStar: { backgroundColor: '#EEF2FF', borderLeftWidth: 3, borderLeftColor: '#4F46E5' },
  discountBannerText: { fontSize: 13, fontWeight: '700', color: '#111827' },
  discountBannerNote: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  // Reservation button
  reservationBtn: { backgroundColor: '#F0FDF4' },
  reservationBtnText: { color: '#16A34A' },
  // Review reply
  replyBox: { backgroundColor: '#F0F9FF', borderRadius: 8, padding: 10, marginTop: 8, borderLeftWidth: 2, borderLeftColor: '#0EA5E9' },
  replyLabel: { fontSize: 11, fontWeight: '700', color: '#0369A1', marginBottom: 3 },
  replyContent: { fontSize: 13, color: '#0C4A6E' },
  // Menu thumbnails
  menuThumb: { width: 80, height: 80, backgroundColor: '#F3F4F6', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 8, overflow: 'hidden' },
  menuThumbImage: { width: 80, height: 80, borderRadius: 10 },
  menuThumbLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'center', paddingHorizontal: 2 },
  // Menü resmi tam ekran görüntüleyici
  imageViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  imageViewerClose: {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 22,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  imageViewerCloseText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  imageViewerImage: { width: '100%', height: '80%' },
  // Inline koleksiyon oluşturma
  inlineCreate: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 10 },
  inlineInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#111827',
  },
  inlineCreateBtn: { backgroundColor: '#FF6B35', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  inlineCreateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
