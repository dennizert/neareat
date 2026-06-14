import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View, FlatList, StyleSheet, ActivityIndicator, Text,
  TouchableOpacity, ScrollView, RefreshControl, TextInput,
} from 'react-native';
import { useRestaurantStore } from '../../store/restaurantStore';
import { fetchNearby } from '../../services/restaurants';
import { getPersonalizedDiscovery } from '../../services/discovery';
import { getCurrentLocation } from '../../services/location';
import RestaurantCard from '../../components/RestaurantCard';
import RestaurantListSkeleton from '../../components/RestaurantListSkeleton';
import EmptyState from '../../components/EmptyState';
import SortFilterBar from '../../components/SortFilterBar';
import MapViewScreen from './MapViewScreen';
import type { Restaurant, PersonalizedDiscovery } from '../../types';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import NotificationBell from '../../components/NotificationBell';
import AppHeader from '../../components/AppHeader';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import { shouldShowSkeleton, isListStale } from '../../utils/listCache';
import { isPersonalizationActive, shouldShowRails, mergeForYou } from '../../utils/personalization';
import PressableScale from '../../components/PressableScale';
import FadeInImage from '../../components/FadeInImage';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const {
    loading, error, viewMode,
    setViewMode, setRestaurants, setLoading, setError,
    getSortedFiltered, setSelectedCategory,
    selectedCuisineTag, setSelectedCuisineTag, restaurants,
    searchQuery, searchResults, searchLoading, searchError,
    setSearchQuery, performSearch, clearSearch,
    searchHistory, loadSearchHistory, deleteSearchHistoryItem,
    lastCoords, lastFetchedAt, _hasHydrated, recordNearbyFetch,
  } = useRestaurantStore();

  const [searchFocused, setSearchFocused] = useState(false);

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  // Sprint-17 #366 — kişiselleştirilmiş Keşfet verisi (raylar + skorlu liste). Hata/boş
  // olursa null kalır ve ekran mevcut nearby deneyimine sorunsuz düşer.
  const [personalized, setPersonalized] = useState<PersonalizedDiscovery | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | undefined>(undefined);
  const lastFetchRef = useRef<number>(0);

  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  // S17-#366 — kişiselleştirilmiş keşif verisini getirir. Sessiz/fire-and-forget:
  // hata olursa personalized null kalır ve liste standart nearby davranışına düşer.
  const loadPersonalized = useCallback(async (coords: { lat: number; lng: number }) => {
    try {
      const data = await getPersonalizedDiscovery(coords.lat, coords.lng);
      setPersonalized(data);
    } catch {
      setPersonalized(null);
    }
  }, []);

  // Fetch all data — category changes are client-side (instant, no API call)
  const loadAll = useCallback(async (forceLocation: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      let coords = forceLocation ? undefined : coordsRef.current;
      if (!coords) {
        coords = await getCurrentLocation();
        coordsRef.current = coords;
        setUserCoords(coords);
      }
      // Always fetch 'all' so every category tab works client-side
      const { results } = await fetchNearby(coords.lat, coords.lng, 'all');
      setRestaurants(results);
      recordNearbyFetch(coords);          // S15-P2 — koordinat + zaman damgasını persist et
      lastFetchRef.current = Date.now();
      loadPersonalized(coords);           // S17-#366 — kişiselleştirmeyi arka planda tazele
    } catch (err: any) {
      setError(err.message || 'Restoranlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setRestaurants, recordNearbyFetch, loadPersonalized]);

  // S15-P2 — Stale-while-revalidate: persist hidrasyonu bitince önbellekteki konumu
  // ref'lere tohumla (GPS'i tekrar bekleme) ve arka planda tazele. Önbellekteki liste
  // zaten anında render edilir; skeleton yalnızca hiç cache yokken görünür.
  useEffect(() => {
    if (!_hasHydrated) return;
    if (lastCoords && !coordsRef.current) {
      coordsRef.current = lastCoords;
      setUserCoords(lastCoords);
    }
    if (lastFetchedAt) lastFetchRef.current = lastFetchedAt;
    // Konum önbellekten geldiyse onu kullan (loadAll(false)); yoksa GPS oku.
    loadAll(!coordsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated]);

  // Refetch when screen gains focus if data is stale (>30s) — bayatsa arka planda tazele
  useFocusEffect(
    useCallback(() => {
      if (isListStale(lastFetchRef.current, Date.now()) && coordsRef.current) {
        loadAll(false);
      }
    }, [loadAll])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll(true);
    setRefreshing(false);
  }

  // Arama: 400ms debounce. Sorgu temizlenince anında nearby listesine döner.
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onSearchChange(text: string) {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (text.trim().length < 2) {
      // 0 veya 1 karakter — bekleme yapmadan temizle
      performSearch('', undefined, undefined);
      return;
    }
    searchDebounceRef.current = setTimeout(() => {
      performSearch(text, coordsRef.current?.lat, coordsRef.current?.lng);
    }, 400);
  }
  useEffect(() => () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); }, []);

  // Category change is instant — just update store, getSortedFiltered handles filtering
  // Kategori filtresi kaldırıldı; persist edilmiş eski seçim listeyi filtrelemesin diye 'all'a sıfırla
  useEffect(() => { setSelectedCategory('all'); }, [setSelectedCategory]);

  // Yüklü restoranlardan unique cuisine tag'lerini çıkar (alfabetik sıralı)
  const availableCuisineTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    restaurants.forEach((r) => r.cuisineTags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [restaurants]);

  const displayedRestaurants = getSortedFiltered();
  const isSearching = searchQuery.trim().length >= 2;
  const displayList = isSearching ? searchResults : displayedRestaurants;

  // S17-#366 — Kişiselleştirme yalnızca varsayılan görünümde devreye girer (saf util kararı).
  const personalizationActive = isPersonalizationActive({ isSearching, selectedCuisineTag, personalized });

  // "Senin İçin" sıralaması: önce kişisel skorlu forYou, ardından kalan nearby (kayıp olmasın).
  const nearbyData = React.useMemo(() => {
    if (!personalizationActive || !personalized) return displayedRestaurants;
    return mergeForYou(personalized.forYou, displayedRestaurants);
  }, [personalizationActive, personalized, displayedRestaurants]);

  const showRails = shouldShowRails({ viewMode, isSearching, selectedCuisineTag, personalized });

  const handlePress = useCallback((restaurant: Restaurant) => {
    navigation.navigate('RestaurantDetail', { placeId: restaurant.placeId });
  }, [navigation]);

  const renderCard = useCallback(({ item }: { item: Restaurant }) => {
    const mins = item.minutesUntilClose;
    const closingVerySoon = typeof mins === 'number' && mins > 0 && mins <= 30;
    const closingSoon = typeof mins === 'number' && mins > 30 && mins <= 60;
    return (
      <RestaurantCard
        restaurant={item}
        onPress={() => handlePress(item)}
        minutesUntilClose={mins ?? null}
        closingSoon={closingSoon}
        closingVerySoon={closingVerySoon}
      />
    );
  }, [handlePress]);

  // S17-#366 — "Son Baktıkların" / "Tekrar gitmek ister misin?" yatay rayları.
  // Nearby listesinin başlığı (ListHeaderComponent) olarak listeyle birlikte kayar.
  const renderMiniCard = useCallback(
    (placeId: string, name: string, photoUrl: string | null, rating: number | null) => (
      <PressableScale
        key={placeId}
        style={styles.miniCard}
        onPress={() => navigation.navigate('RestaurantDetail', { placeId })}
        accessibilityLabel={`${name} restoranını aç`}
      >
        {photoUrl ? (
          <FadeInImage source={{ uri: photoUrl }} style={styles.miniPhoto} />
        ) : (
          <View style={[styles.miniPhoto, styles.miniPhotoPlaceholder]}>
            <Text style={styles.miniPhotoIcon}>🍽️</Text>
          </View>
        )}
        <Text style={styles.miniName} numberOfLines={1}>{name}</Text>
        {rating != null && rating > 0 && <Text style={styles.miniMeta}>★ {rating.toFixed(1)}</Text>}
      </PressableScale>
    ),
    [styles, navigation],
  );

  const renderRails = useCallback(() => {
    if (!personalized) return null;
    const { recentlyViewed, revisit } = personalized;
    return (
      <View>
        {recentlyViewed.length > 0 && (
          <View style={styles.railSection}>
            <Text style={styles.railTitle}>Son Baktıkların</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
              {recentlyViewed.map((p) => renderMiniCard(p.placeId, p.name, p.photoUrl, p.rating))}
            </ScrollView>
          </View>
        )}
        {revisit.length > 0 && (
          <View style={styles.railSection}>
            <Text style={styles.railTitle}>Tekrar gitmek ister misin?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
              {revisit.map((p) => renderMiniCard(p.placeId, p.name, p.photoUrl, p.rating))}
            </ScrollView>
          </View>
        )}
        {personalizationActive && <Text style={styles.forYouLabel}>Senin İçin</Text>}
      </View>
    );
  }, [personalized, personalizationActive, styles, renderMiniCard]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <AppHeader
        center={(
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleActive]}
              onPress={() => setViewMode('list')}
            >
              <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>Liste</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'map' && styles.toggleActive]}
              onPress={() => setViewMode('map')}
            >
              <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Harita</Text>
            </TouchableOpacity>
          </View>
        )}
        right={<NotificationBell />}
      />

      {/* Doğrulanmamış e-posta uyarı bandı (S14-M1) */}
      <EmailVerificationBanner />

      {/* Arama çubuğu (S6-2) */}
      {viewMode === 'list' && (
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Restoran ara (örn. tarihi yarımadada pizza)"
            placeholderTextColor={C.textMuted}
            value={searchQuery}
            onChangeText={onSearchChange}
            onFocus={() => { setSearchFocused(true); loadSearchHistory(); }}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { clearSearch(); }} style={styles.searchClear}>
              <Text style={styles.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Son aramalar dropdown'u (S6-7) */}
      {viewMode === 'list' && searchFocused && searchQuery.trim().length < 2 && searchHistory.length > 0 && (
        <View style={styles.historyBox}>
          <Text style={styles.historyTitle}>Son Aramalar</Text>
          {searchHistory.slice(0, 8).map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <TouchableOpacity
                style={styles.historyTap}
                onPress={() => {
                  setSearchQuery(item.query);
                  performSearch(item.query, coordsRef.current?.lat, coordsRef.current?.lng);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.historyIcon}>🕘</Text>
                <Text style={styles.historyText} numberOfLines={1}>{item.query}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteSearchHistoryItem(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.historyDelete}
              >
                <Text style={styles.historyDeleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* AI Recommendation CTAs — kompakt, yan yana */}
      {viewMode === 'list' && (
        <View style={styles.aiRow}>
          <PressableScale
            style={styles.aiCta}
            onPress={() => navigation.navigate('Recommendation')}
            accessibilityLabel="Yapay zekâ önerisi: Şimdi ne yesem?"
          >
            <Text style={styles.aiCtaEmoji}>🤖</Text>
            <Text style={styles.aiCtaTitle} numberOfLines={1}>Şimdi ne yesem?</Text>
          </PressableScale>
          <PressableScale
            style={styles.routeCta}
            onPress={() => navigation.navigate('RouteRecommendation')}
            accessibilityLabel="Rota önerisi: Yolda ne yesem?"
          >
            <Text style={styles.aiCtaEmoji}>🗺️</Text>
            <Text style={styles.routeCtaTitle} numberOfLines={1}>Yolda ne yesem?</Text>
          </PressableScale>
        </View>
      )}

      {/* Cuisine Tag Chips (S7-10) — sadece nearby listesinde göster */}
      {viewMode === 'list' && !isSearching && availableCuisineTags.length > 0 && (
        <View style={styles.cuisineBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cuisineRow}
          >
            {selectedCuisineTag !== null && (
              <TouchableOpacity
                style={styles.cuisineClearChip}
                onPress={() => setSelectedCuisineTag(null)}
                activeOpacity={0.75}
              >
                <Text style={styles.cuisineClearText}>✕ Temizle</Text>
              </TouchableOpacity>
            )}
            {availableCuisineTags.map((tag) => {
              const active = selectedCuisineTag === tag;
              return (
                <TouchableOpacity
                  key={tag}
                  style={[styles.cuisineChip, active && styles.cuisineChipActive]}
                  onPress={() => setSelectedCuisineTag(active ? null : tag)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.cuisineChipText, active && styles.cuisineChipTextActive]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {viewMode === 'map' ? (
        <MapViewScreen
          restaurants={displayedRestaurants}
          onPressRestaurant={handlePress}
          userLat={userCoords?.lat}
          userLng={userCoords?.lng}
        />
      ) : isSearching ? (
        <>
          {searchLoading && <ActivityIndicator style={styles.loader} color={C.primary} />}
          {searchError && <Text style={styles.errorText}>{searchError}</Text>}
          {!searchLoading && !searchError && displayList.length === 0 && (
            <EmptyState
              icon="search"
              title="Sonuç bulunamadı"
              description="Farklı bir kelime ya da mutfak türüyle aramayı dene."
            />
          )}
          {!searchLoading && !searchError && displayList.length > 0 && (
            <FlatList
              data={displayList}
              keyExtractor={(r) => r.placeId}
              renderItem={renderCard}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              windowSize={5}
              maxToRenderPerBatch={6}
              initialNumToRender={8}
              removeClippedSubviews
              keyboardShouldPersistTaps="handled"
            />
          )}
        </>
      ) : (
        <>
          <SortFilterBar />
          {shouldShowSkeleton({ hasHydrated: _hasHydrated, loading, itemCount: displayedRestaurants.length }) && <RestaurantListSkeleton />}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!error && (loading ? displayedRestaurants.length > 0 : true) && (
            <FlatList
              data={nearbyData}
              keyExtractor={(r) => r.placeId}
              renderItem={renderCard}
              ListHeaderComponent={showRails ? renderRails : undefined}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              windowSize={5}
              maxToRenderPerBatch={6}
              initialNumToRender={8}
              removeClippedSubviews
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} />
              }
            />
          )}
        </>
      )}
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    viewToggle: { flexDirection: 'row', backgroundColor: C.surfaceAlt, borderRadius: 8, padding: 2 },
    toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
    toggleActive: { backgroundColor: C.primary },
    toggleText: { fontSize: 13, color: C.textTertiary, fontWeight: '500' },
    toggleTextActive: { color: '#fff' },

    // Yan yana 2 kompakt AI CTA satırı
    aiRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 6,
      marginBottom: 8,
    },
    // AI butonu (mor değil çünkü buradan AI ekranına girilir; ekran içinde AI rengi devreye girer)
    aiCta: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.primary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      shadowColor: C.primary,
      shadowOpacity: 0.20,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    aiCtaEmoji: { fontSize: 18 },
    aiCtaTitle: { color: C.primaryOn, fontSize: 13, fontWeight: '700', flex: 1 },

    // Rota butonu (travel teal aksanı dış kenarda)
    routeCta: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.travel,
    },
    routeCtaTitle: { color: C.travel, fontSize: 13, fontWeight: '700', flex: 1 },


    cuisineBar: { backgroundColor: C.surface, borderBottomWidth: 1, borderColor: C.separator },
    cuisineRow: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
    cuisineChip: {
      height: 28, paddingHorizontal: 12, borderRadius: 14,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.background,
      justifyContent: 'center', alignItems: 'center',
    },
    cuisineChipActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
    cuisineChipText: { fontSize: 12, fontWeight: '600', color: C.textSecondary },
    cuisineChipTextActive: { color: C.primary },
    cuisineClearChip: {
      height: 28, paddingHorizontal: 10, borderRadius: 14,
      backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
      justifyContent: 'center', alignItems: 'center',
    },
    cuisineClearText: { fontSize: 11, fontWeight: '700', color: C.textMuted },

    // S17-#366 — kişiselleştirme rayları + mini kartlar
    railSection: { marginBottom: 14 },
    railTitle: { fontSize: 14, fontWeight: '800', color: C.textPrimary, marginBottom: 8 },
    railRow: { flexDirection: 'row', gap: 10, paddingRight: 8 },
    miniCard: { width: 128 },
    miniPhoto: { width: 128, height: 84, borderRadius: 10, backgroundColor: C.surfaceAlt },
    miniPhotoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    miniPhotoIcon: { fontSize: 24 },
    miniName: { fontSize: 12.5, fontWeight: '600', color: C.textPrimary, marginTop: 5 },
    miniMeta: { fontSize: 11.5, color: C.warning, fontWeight: '600', marginTop: 1 },
    forYouLabel: { fontSize: 14, fontWeight: '800', color: C.textPrimary, marginBottom: 4 },

    loader: { marginTop: 40 },
    errorText: { textAlign: 'center', color: C.error, marginTop: 40, paddingHorizontal: 16 },
    emptyText: { textAlign: 'center', color: C.textMuted, marginTop: 40, paddingHorizontal: 16 },
    list: { padding: 16 },

    searchRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surfaceAlt, borderRadius: 12,
      marginHorizontal: 16, marginTop: 8,
      paddingHorizontal: 12, paddingVertical: 8,
    },
    searchIcon: { fontSize: 14, marginRight: 8, color: C.textMuted },
    searchInput: { flex: 1, fontSize: 14, color: C.textPrimary, padding: 0 },
    searchClear: {
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: C.disabled, justifyContent: 'center', alignItems: 'center',
      marginLeft: 6,
    },
    searchClearText: { fontSize: 12, color: '#fff', fontWeight: '700' },

    historyBox: {
      backgroundColor: C.surface, marginHorizontal: 16, marginTop: 4,
      borderRadius: 12, paddingVertical: 6, paddingHorizontal: 4,
      borderWidth: 1, borderColor: C.separator,
    },
    historyTitle: {
      fontSize: 11, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase',
      paddingHorizontal: 10, paddingTop: 4, paddingBottom: 6, letterSpacing: 0.5,
    },
    historyRow: { flexDirection: 'row', alignItems: 'center' },
    historyTap: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 },
    historyIcon: { fontSize: 13, marginRight: 8, color: C.textMuted },
    historyText: { fontSize: 14, color: C.textPrimary, flex: 1 },
    historyDelete: { paddingHorizontal: 10, paddingVertical: 6 },
    historyDeleteText: { fontSize: 12, color: C.textMuted, fontWeight: '700' },
  });
}
