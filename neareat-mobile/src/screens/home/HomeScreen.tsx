import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View, FlatList, StyleSheet, ActivityIndicator, Text,
  TouchableOpacity, ScrollView, RefreshControl, TextInput,
} from 'react-native';
import { useRestaurantStore } from '../../store/restaurantStore';
import { fetchNearby } from '../../services/restaurants';
import { getCurrentLocation } from '../../services/location';
import RestaurantCard from '../../components/RestaurantCard';
import RestaurantListSkeleton from '../../components/RestaurantListSkeleton';
import EmptyState from '../../components/EmptyState';
import SortFilterBar from '../../components/SortFilterBar';
import MapViewScreen from './MapViewScreen';
import type { Restaurant } from '../../types';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import NotificationBell from '../../components/NotificationBell';
import AppHeader from '../../components/AppHeader';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

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
  } = useRestaurantStore();

  const [searchFocused, setSearchFocused] = useState(false);

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const coordsRef = useRef<{ lat: number; lng: number } | undefined>(undefined);
  const lastFetchRef = useRef<number>(0);

  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

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
      lastFetchRef.current = Date.now();
    } catch (err: any) {
      setError(err.message || 'Restoranlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setRestaurants]);

  useEffect(() => { loadAll(true); }, []);

  // Refetch when screen gains focus if data is older than 30 seconds
  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastFetchRef.current > 30000 && coordsRef.current) {
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
          <TouchableOpacity
            style={styles.aiCta}
            onPress={() => navigation.navigate('Recommendation')}
            activeOpacity={0.85}
          >
            <Text style={styles.aiCtaEmoji}>🤖</Text>
            <Text style={styles.aiCtaTitle} numberOfLines={1}>Şimdi ne yesem?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.routeCta}
            onPress={() => navigation.navigate('RouteRecommendation')}
            activeOpacity={0.85}
          >
            <Text style={styles.aiCtaEmoji}>🗺️</Text>
            <Text style={styles.routeCtaTitle} numberOfLines={1}>Yolda ne yesem?</Text>
          </TouchableOpacity>
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
          {loading && displayedRestaurants.length === 0 && <RestaurantListSkeleton />}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!error && (loading ? displayedRestaurants.length > 0 : true) && (
            <FlatList
              data={displayedRestaurants}
              keyExtractor={(r) => r.placeId}
              renderItem={renderCard}
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
