import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking,
  ActivityIndicator, Alert, Share, Image, TextInput, Modal, FlatList,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { fetchRestaurantDetail, fetchAppReviews, createReview } from '../../services/restaurants';
import { addFavorite, removeFavorite } from '../../services/favorites';
import { useFavoriteStore } from '../../store/favoriteStore';
import { useAuthStore } from '../../store/authStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { useCollectionStore } from '../../store/collectionStore';
import { createCheckin } from '../../services/checkin';
import { addDiaryEntry } from '../../services/diary';
import { analyzePhoto, type PhotoAnalysisResult } from '../../services/photoAnalysis';
import { getMyCollections, addToCollection, createCollection } from '../../services/collections';
import { getClosingInfo } from '../../utils/closingTime';
import { computeAppRating } from '../../utils/appRating';
import { submitPlaceRequest } from '../../services/placeRequests';
import StarRating from '../../components/StarRating';
import PhotoGallery from '../../components/PhotoGallery';
import ProductPhotosSection from '../../components/ProductPhotosSection';
import AppIcon from '../../components/AppIcon';
import type { IconName } from '../../theme/icons';
import Skeleton from '../../components/Skeleton';
import { useToast } from '../../hooks/useToast';
import { haptics } from '../../utils/haptics';
import type { RestaurantDetail, AppReview, Collection, Favorite } from '../../types';
import { formatDistance } from '../../utils/haversine';
import NotificationBell from '../../components/NotificationBell';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

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
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [appReviews, setAppReviews] = useState<AppReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'google' | 'app'>('google');
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [addMenuVisible, setAddMenuVisible] = useState(false);

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

  // S7-6 — fotoğraf analizi
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysisResult | null>(null);
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);

  const { isFavorite, addFavorite: storeFav, removeFavorite: storeRemoveFav } = useFavoriteStore();
  const { isPremium, user } = useAuthStore();
  const { addStarEvent } = useUserProfileStore();
  const { myCollections, setMyCollections } = useCollectionStore();
  const toast = useToast();

  const favorited = isFavorite(placeId);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      (async () => {
        try {
          const [d, reviews] = await Promise.all([
            fetchRestaurantDetail(placeId),
            fetchAppReviews(placeId),
          ]);
          setDetail(d);
          setAppReviews(reviews);
        } catch (err: any) {
          // userMessage interceptor'dan gelir (çevrimdışıyken anlamlı Türkçe mesaj)
          Alert.alert('Hata', err.userMessage || err.message || 'Restoran bilgileri yüklenemedi.');
        } finally {
          setLoading(false);
        }
      })();
    });
    return () => task.cancel();
  }, [placeId]);

  async function toggleFavorite() {
    if (!detail) return;
    const wasFavorited = favorited;
    haptics.light();
    // Optimistik: önce UI'ı güncelle, sunucu hatasında geri al.
    const provisional: Favorite = {
      id: `temp-${placeId}`, placeId, placeName: detail.name,
      placeAddress: detail.formattedAddress ?? null,
      placeLat: detail.location?.lat ?? 0, placeLng: detail.location?.lng ?? 0,
      placePhone: null, placePhotoUrl: detail.photos?.[0] ?? null,
      placeRating: detail.rating ?? null,
    };
    if (wasFavorited) storeRemoveFav(placeId); else storeFav(provisional);
    try {
      if (wasFavorited) {
        await removeFavorite(placeId);
      } else {
        const fav = await addFavorite(detail);
        storeFav(fav); // geçici kaydı gerçek kayıtla değiştir
      }
    } catch (err: any) {
      // rollback
      if (wasFavorited) storeFav(provisional); else storeRemoveFav(placeId);
      if (err.response?.data?.code === 'PREMIUM_REQUIRED') {
        navigation.navigate('Paywall', { trigger: 'favorites' });
      } else {
        Alert.alert('Hata', err.message);
      }
    }
  }

  function openReviewModal() {
    setReviewRating(5);
    setReviewModalVisible(true);
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
      toast.show(starEvent ? 'Yorumun eklendi · +5 ⭐' : 'Yorumun güncellendi', 'success');
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

  async function handlePhotoAnalyze(photoUrl: string) {
    if (photoAnalyzing) return;
    setPhotoAnalyzing(true);
    setPhotoAnalysis(null);
    try {
      const result = await analyzePhoto({
        imageUrl: photoUrl,
        placeId: detail?.placeId,
        placeName: detail?.name,
        placeAddress: detail?.formattedAddress ?? undefined,
      });
      setPhotoAnalysis(result);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        Alert.alert('Günlük limit doldu', 'Fotoğraf analizi günlük limitine ulaştın. Yarın tekrar deneyebilirsin ya da premium olabilirsin.');
      } else {
        Alert.alert('Hata', 'Analiz yapılamadı, lütfen tekrar dene.');
      }
    } finally {
      setPhotoAnalyzing(false);
    }
  }

  async function handleAddToDiary() {
    if (!detail) return;
    try {
      await addDiaryEntry({
        placeId: detail.placeId,
        placeName: detail.name,
        placePhotoUrl: detail.photos?.[0] ?? null,
        placeTypes: detail.types ?? [],
      });
      toast.show('Yemek günlüğüne eklendi', 'success');
    } catch (err: any) {
      Alert.alert('Hata', err?.message ?? 'Günlüğe eklenemedi.');
    }
  }

  async function handleCheckin() {
    if (!detail) return;
    try {
      await createCheckin(detail.placeId, detail.name);
      toast.show('Check-in yapıldı! Arkadaşların bildirim aldı', 'success');
    } catch (err: any) {
      Alert.alert('Hata', err?.message ?? 'Check-in yapılamadı.');
    }
  }

  async function handleShare() {
    if (!detail) return;
    try {
      const address = detail.formattedAddress ?? '';
      const rating = detail.rating != null ? `★ ${detail.rating}` : '';
      await Share.share({
        title: detail.name,
        message: `${detail.name}${rating ? ' — ' + rating : ''}${address ? '\n' + address : ''}\nEatlas'tan keşfet!`,
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

  async function handleSuggestPlace() {
    if (!detail) return;
    Alert.alert(
      'Platforma Ekle',
      `"${detail.name}" mekanını NearEat'e eklenmesi için önermek ister misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Ekle',
          onPress: async () => {
            try {
              await submitPlaceRequest({
                placeId: detail.placeId,
                placeName: detail.name,
                placeAddress: detail.formattedAddress ?? undefined,
              });
              toast.show('Talebin alındı, teşekkürler!', 'success');
            } catch (err: any) {
              const msg = err.response?.data?.error;
              if (err.response?.status === 409) {
                Alert.alert('Zaten Önerildi', 'Bu mekan için zaten bir talebiniz bulunuyor.');
              } else {
                Alert.alert('Hata', msg ?? 'Talep gönderilemedi.');
              }
            }
          },
        },
      ],
    );
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
      toast.show(`"${col.name}" listesine eklendi`, 'success');
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
      toast.show(`"${col.name}" oluşturuldu ve eklendi`, 'success');
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Liste oluşturulamadı.');
    } finally {
      setCreatingColl(false);
    }
  }

  function ActionButton({ icon, label, onPress, tint, bg }: {
    icon: IconName; label: string; onPress: () => void; tint?: string; bg?: string;
  }) {
    return (
      <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.actionIcon, bg ? { backgroundColor: bg } : null]}>
          <AppIcon name={icon} size={20} color={tint ?? C.textSecondary} />
        </View>
        <Text style={styles.actionLabel} numberOfLines={1}>{label}</Text>
      </TouchableOpacity>
    );
  }

  function renderAppReviews() {
    return (
      <>
        <TouchableOpacity
          style={styles.writeReviewBtn}
          onPress={openReviewModal}
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
    return (
      <View style={styles.container}>
        <Skeleton width="100%" height={240} radius={0} />
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton width="65%" height={24} />
          <Skeleton width="40%" height={14} />
          <Skeleton width="100%" height={56} radius={12} />
          <Skeleton width="90%" height={14} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="55%" height={14} />
        </View>
      </View>
    );
  }

  if (!detail) return null;

  const appRating = computeAppRating(appReviews);
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
        <PhotoGallery photos={detail.photos} onAnalyze={handlePhotoAnalyze} />

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={2}>{detail.name}</Text>
              <Text style={styles.meta}>
                {[
                  PRICE_MAP[detail.priceLevel ?? 0],
                  detail.distanceKm != null ? formatDistance(detail.distanceKm) : undefined,
                ].filter(Boolean).join('  ·  ')}
              </Text>
              {favorited && (
                <View style={styles.favTag}>
                  <AppIcon name="heart" size={12} color={C.error} />
                  <Text style={styles.favTagText}>Favorilerinde</Text>
                </View>
              )}
              {detail.isRegistered && (
                <View style={styles.registeredTag}>
                  <AppIcon name="verified" size={12} color={C.primary} />
                  <Text style={styles.registeredTagText}>Eatlas'ta Kayıtlı</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.checkinPill} onPress={handleCheckin} activeOpacity={0.8}>
              <AppIcon name="checkin" size={15} color="#fff" />
              <Text style={styles.checkinPillText}>Check-in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtnTop} onPress={() => setAddMenuVisible(true)} activeOpacity={0.7}>
              <AppIcon name="add" size={24} color={C.primary} />
            </TouchableOpacity>
          </View>

          {/* Çift puan: Google + Eatlas (uygulama içi) */}
          <View style={styles.dualRatingRow}>
            <View style={styles.ratingBlock}>
              <View style={styles.ratingSourceRow}>
                <Ionicons name="logo-google" size={13} color={C.textTertiary} />
                <Text style={styles.ratingSource}>Google</Text>
              </View>
              <StarRating rating={detail.rating} size={14} />
              <Text style={styles.ratingText}>{detail.rating} ({detail.userRatingsTotal} oy)</Text>
            </View>

            <View style={styles.ratingDivider} />

            <View style={styles.ratingBlock}>
              <View style={styles.ratingSourceRow}>
                <Image source={require('../../../assets/icon.png')} style={styles.eatlasIcon} />
                <Text style={styles.ratingSource}>Eatlas</Text>
              </View>
              {appRating.count > 0 ? (
                <>
                  <StarRating rating={appRating.avg} size={14} />
                  <Text style={styles.ratingText}>{appRating.avg.toFixed(1)} ({appRating.count} oy)</Text>
                </>
              ) : (
                <Text style={styles.ratingEmpty}>Henüz puan yok</Text>
              )}
            </View>
          </View>

          {(detail.openingHours || detail.openingHoursOverride) && (
            <View style={styles.openBadgeRow}>
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
            </View>
          )}

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

          {/* ─── Rezervasyon birincil CTA ─── */}
          {detail.acceptsReservations && detail.restaurantId ? (
            <TouchableOpacity
              style={styles.reserveCta}
              onPress={() => navigation.navigate('MakeReservation', {
                placeId: detail.placeId,
                placeName: detail.name,
                restaurantId: detail.restaurantId!,
              })}
            >
              <AppIcon name="reservation" size={18} color="#fff" />
              <Text style={styles.reserveCtaText}>Rezervasyon</Text>
            </TouchableOpacity>
          ) : !detail.acceptsReservations && detail.reservationUrl ? (
            <TouchableOpacity style={styles.reserveCta} onPress={() => Linking.openURL(detail.reservationUrl!)}>
              <AppIcon name="reservation" size={18} color="#fff" />
              <Text style={styles.reserveCtaText}>Rezervasyon</Text>
            </TouchableOpacity>
          ) : null}

          {/* ─── Kompakt eylem ikonları (sarmalanan, kaydırmasız) ─── */}
          <View style={styles.actionRow}>
            <ActionButton icon="map" label="Konum" tint={C.travel} bg={C.travelSurface} onPress={handleDirections} />
            {detail.formattedPhoneNumber ? (
              <ActionButton icon="phone" label="Ara" onPress={() => Linking.openURL(`tel:${detail.formattedPhoneNumber}`)} />
            ) : null}
            <ActionButton icon="share" label="Paylaş" onPress={handleShare} />
            <ActionButton icon="message" label="Öner" tint={C.primary} bg={C.primaryLighter} onPress={handleRecommend} />
            {!detail.restaurantId && (
              <ActionButton icon="restaurant" label="Platforma Ekle" tint={C.travel} bg={C.travelSurface} onPress={handleSuggestPlace} />
            )}
          </View>

          {(detail.openingHoursOverride || detail.openingHours?.weekday_text) && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => setHoursExpanded(v => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.sectionTitle}>Çalışma Saatleri</Text>
                <Ionicons
                  name={hoursExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={C.textTertiary}
                />
              </TouchableOpacity>
              {hoursExpanded && (
                detail.openingHoursOverride
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
              )}
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

          {/* Ürün Fotoğrafları — sahibin yüklediği PRODUCT galerisi (S10-6) */}
          <ProductPhotosSection photos={detail.productPhotos ?? []} onPressPhoto={setSelectedMenuImage} />

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
                placeholderTextColor={C.textMuted}
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
            <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
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

      {/* Fotoğraf Analizi Modal (S7-6) */}
      <Modal
        visible={photoAnalyzing || !!photoAnalysis}
        animationType="slide"
        transparent
        onRequestClose={() => { setPhotoAnalysis(null); setPhotoAnalyzing(false); }}
      >
        <View style={styles.analysisOverlay}>
          <View style={styles.analysisSheet}>
            <View style={styles.analysisHeader}>
              <Text style={styles.analysisTitle}>🤖 Fotoğraf Analizi</Text>
              <TouchableOpacity onPress={() => { setPhotoAnalysis(null); setPhotoAnalyzing(false); }}>
                <Text style={styles.analysisClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {photoAnalyzing && (
              <View style={styles.analysisCentered}>
                <ActivityIndicator color={styles.analysisPrimary.color} size="large" />
                <Text style={styles.analysisLoadingText}>Claude fotoğrafı analiz ediyor...</Text>
              </View>
            )}
            {!photoAnalyzing && photoAnalysis && (
              <>
                {photoAnalysis.analysis ? (
                  <Text style={styles.analysisText}>{photoAnalysis.analysis}</Text>
                ) : (
                  <Text style={styles.analysisEmpty}>Analiz yapılamadı, lütfen tekrar dene.</Text>
                )}
                {photoAnalysis.remainingToday != null && (
                  <Text style={styles.analysisRemaining}>
                    Bugün kalan hakkın: {photoAnalysis.remainingToday}
                  </Text>
                )}
              </>
            )}
          </View>
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

      {/* "+" Ekle menüsü — Günlük / Liste */}
      <Modal
        visible={addMenuVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setAddMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.addMenuOverlay}
          activeOpacity={1}
          onPress={() => setAddMenuVisible(false)}
        >
          <View style={styles.addMenuSheet}>
            <TouchableOpacity
              style={styles.addMenuRow}
              onPress={() => { setAddMenuVisible(false); toggleFavorite(); }}
            >
              <AppIcon name={favorited ? 'heart' : 'heartOutline'} size={20} color={favorited ? C.error : C.textSecondary} />
              <Text style={styles.addMenuText}>{favorited ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}</Text>
            </TouchableOpacity>
            <View style={styles.addMenuDivider} />
            <TouchableOpacity
              style={styles.addMenuRow}
              onPress={() => { setAddMenuVisible(false); handleAddToDiary(); }}
            >
              <AppIcon name="diary" size={20} color={C.textSecondary} />
              <Text style={styles.addMenuText}>Günlüğe Ekle</Text>
            </TouchableOpacity>
            <View style={styles.addMenuDivider} />
            <TouchableOpacity
              style={styles.addMenuRow}
              onPress={() => { setAddMenuVisible(false); handleOpenCollectionModal(); }}
            >
              <AppIcon name="collection" size={20} color={C.textSecondary} />
              <Text style={styles.addMenuText}>Listeye Ekle</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
                ? <ActivityIndicator size="small" color={C.primary} />
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
            placeholderTextColor={C.textMuted}
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

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.surface },
    content: { padding: 16 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    name: { fontSize: 22, fontWeight: '700', color: C.textPrimary },
    meta: { fontSize: 14, color: C.textTertiary, marginTop: 2 },
    favTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    favTagText: { fontSize: 12, color: C.error, fontWeight: '700' },
    registeredTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    registeredTagText: { fontSize: 12, color: C.primary, fontWeight: '700' },
    checkinPill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
    },
    checkinPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    addBtnTop: {
      width: 40, height: 40, borderRadius: 20,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.primaryLighter,
      alignItems: 'center', justifyContent: 'center',
    },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    ratingText: { fontSize: 14, color: C.textSecondary },
    // Çift puan blokları (Google + Eatlas)
    dualRatingRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    ratingBlock: { flex: 1, gap: 3 },
    ratingSourceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1 },
    ratingSource: { fontSize: 12, fontWeight: '600', color: C.textTertiary },
    eatlasIcon: { width: 14, height: 14, borderRadius: 3 },
    ratingDivider: { width: 1, alignSelf: 'stretch', backgroundColor: C.separator, marginHorizontal: 14 },
    ratingEmpty: { fontSize: 13, color: C.textMuted, fontStyle: 'italic', marginTop: 2 },
    openBadgeRow: { flexDirection: 'row', marginBottom: 12 },
    openBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
    openBadgeOpen: { backgroundColor: C.successSurface },
    openBadgeClosed: { backgroundColor: C.errorSurface },
    openBadgeClosingSoon: { backgroundColor: C.warningSurface },
    openBadgeClosingVery: { backgroundColor: C.errorSurface },
    openBadgeText: { fontSize: 12, fontWeight: '600', color: C.textPrimary },
    closingBanner: {
      backgroundColor: C.warningSurface, borderRadius: 10, padding: 12,
      marginBottom: 12, borderLeftWidth: 3, borderLeftColor: C.warning,
    },
    closingBannerUrgent: { backgroundColor: C.errorSurface, borderLeftColor: C.error },
    closingBannerText: { fontSize: 13, fontWeight: '600', color: C.warning },
    // ─── Rezervasyon birincil CTA ───────────────────────────────
    reserveCta: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, marginBottom: 14,
    },
    reserveCtaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    // ─── Kompakt eylem ikonları ─────────────────────────────────
    actionRow: {
      flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around',
      columnGap: 8, rowGap: 14, marginBottom: 20,
    },
    actionBtn: { alignItems: 'center', minWidth: 58 },
    actionIcon: {
      width: 46, height: 46, borderRadius: 23, backgroundColor: C.surfaceAlt,
      alignItems: 'center', justifyContent: 'center', marginBottom: 5,
    },
    actionLabel: { fontSize: 11, fontWeight: '600', color: C.textSecondary, textAlign: 'center' },
    // ─── "+" Ekle menüsü ────────────────────────────────────────
    addMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
    addMenuSheet: {
      backgroundColor: C.surface, borderRadius: 16, minWidth: 240, overflow: 'hidden',
      shadowColor: C.shadow, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
    },
    addMenuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
    addMenuText: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
    addMenuDivider: { height: 1, backgroundColor: C.separator },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, marginBottom: 8 },
    collapsibleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    hourLine: { fontSize: 13, color: C.textTertiary, marginBottom: 2 },
    todayLine: { fontWeight: '700', color: C.textPrimary },
    premiumHint: { fontSize: 13, color: C.textMuted },
    blurSection: { backgroundColor: C.background, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20 },
    blurText: { fontSize: 15, color: C.primary, fontWeight: '600' },
    tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: C.border, marginBottom: 16 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderColor: C.primary },
    tabText: { fontSize: 14, color: C.textMuted },
    tabTextActive: { color: C.primary, fontWeight: '600' },
    writeReviewBtn: {
      backgroundColor: C.primaryLighter, borderRadius: 12, padding: 14,
      alignItems: 'center', marginBottom: 14,
    },
    writeReviewText: { color: C.primary, fontWeight: '700', fontSize: 15 },
    reviewCard: { backgroundColor: C.background, borderRadius: 12, padding: 14, marginBottom: 10 },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 10 },
    reviewAvatar: { width: 32, height: 32, borderRadius: 16 },
    reviewAvatarPlaceholder: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center',
    },
    reviewAuthor: { fontWeight: '600', color: C.textPrimary, marginBottom: 2 },
    reviewDate: { fontSize: 11, color: C.textMuted, marginBottom: 4 },
    reviewBody: { fontSize: 13, color: C.textSecondary, lineHeight: 20 },
    emptyText: { textAlign: 'center', color: C.textMuted, marginTop: 20 },
    paywallHint: { backgroundColor: C.primaryLighter, borderRadius: 12, padding: 16, alignItems: 'center' },
    paywallHintText: { color: C.primary, fontWeight: '600' },
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
    modalContainer: { flex: 1, backgroundColor: C.surface, padding: 20 },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: 16, borderBottomWidth: 1, borderColor: C.separator,
    },
    modalCancel: { fontSize: 16, color: C.textTertiary },
    modalTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary },
    modalSubmit: { fontSize: 16, color: C.primary, fontWeight: '700' },
    modalRestaurant: { fontSize: 16, fontWeight: '600', color: C.textSecondary, marginTop: 16, marginBottom: 12 },
    modalStarsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    modalStar: { fontSize: 32 },
    modalInput: {
      borderWidth: 1, borderColor: C.border, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 15, color: C.textPrimary, minHeight: 120,
      textAlignVertical: 'top', backgroundColor: C.inputBg,
    },
    starEarnHint: {
      backgroundColor: C.warningSurface, borderRadius: 12, padding: 14,
      alignItems: 'center', marginTop: 16,
    },
    starEarnHintText: { color: C.warning, fontWeight: '600', fontSize: 14 },
    // Koleksiyon modal stilleri
    emptyCollections: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyCollectionsTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, marginBottom: 8 },
    emptyCollectionsText: { fontSize: 14, color: C.textTertiary, textAlign: 'center', marginBottom: 20 },
    goCollectionsBtn: {
      backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24,
    },
    goCollectionsBtnText: { color: C.primaryOn, fontWeight: '700', fontSize: 15 },
    collectionRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
      borderRadius: 12, padding: 14, marginBottom: 10,
      shadowColor: C.shadow, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    collectionRowIcon: {
      width: 44, height: 44, borderRadius: 12, backgroundColor: C.surfaceAlt,
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    collectionRowName: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
    collectionRowMeta: { fontSize: 12, color: C.textMuted, marginTop: 2 },
    collectionRowAdd: { fontSize: 22, color: C.primary, fontWeight: '700', paddingLeft: 8 },
    // Announcement & discount banners — duyuru: nötr+amber, yıldız ind.: amber
    announcementBanner: { backgroundColor: C.amberSurface, borderRadius: 10, padding: 10, marginBottom: 10 },
    announcementBannerText: { fontSize: 13, color: C.amber, fontWeight: '600' },
    discountBanner: { borderRadius: 10, padding: 12, marginBottom: 12 },
    discountBannerInstant: { backgroundColor: C.warningSurface, borderLeftWidth: 3, borderLeftColor: C.warning },
    discountBannerStar: { backgroundColor: C.amberSurface, borderLeftWidth: 3, borderLeftColor: C.amber },
    discountBannerText: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
    discountBannerNote: { fontSize: 12, color: C.textTertiary, marginTop: 4 },
    // Review reply — restoran sahibi yanıtı (nötr, brand rengi kullanma)
    replyBox: {
      backgroundColor: C.surfaceAlt, borderRadius: 8, padding: 10, marginTop: 8,
      borderLeftWidth: 2, borderLeftColor: C.border,
    },
    replyLabel: { fontSize: 11, fontWeight: '700', color: C.textSecondary, marginBottom: 3 },
    replyContent: { fontSize: 13, color: C.textPrimary },
    // Menu thumbnails
    menuThumb: { width: 80, height: 80, backgroundColor: C.inputBg, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 8, overflow: 'hidden' },
    menuThumbImage: { width: 80, height: 80, borderRadius: 10 },
    menuThumbLabel: { fontSize: 10, color: C.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: 2 },
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
    inlineCreate: { padding: 16, borderBottomWidth: 1, borderBottomColor: C.separator, gap: 10 },
    inlineInput: {
      borderWidth: 1, borderColor: C.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.textPrimary,
    },
    inlineCreateBtn: { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    inlineCreateBtnText: { color: C.primaryOn, fontWeight: '700', fontSize: 14 },
    // S7-6 — fotoğraf analizi modal
    analysisOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    analysisSheet: {
      backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 20, paddingBottom: 40, minHeight: 200,
    },
    analysisHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    analysisTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary },
    analysisClose: { fontSize: 18, color: C.textMuted, fontWeight: '600', padding: 4 },
    analysisCentered: { alignItems: 'center', paddingVertical: 24, gap: 12 },
    analysisPrimary: { color: C.primary },
    analysisLoadingText: { fontSize: 14, color: C.textMuted },
    analysisText: { fontSize: 15, color: C.textSecondary, lineHeight: 24 },
    analysisEmpty: { fontSize: 14, color: C.textMuted, fontStyle: 'italic' },
    analysisRemaining: { fontSize: 12, color: C.textMuted, marginTop: 12 },
  });
}
