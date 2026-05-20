import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View, FlatList, StyleSheet, ActivityIndicator, Text,
  TouchableOpacity, ScrollView, RefreshControl,
} from 'react-native';
import { useRestaurantStore } from '../../store/restaurantStore';
import { fetchNearby } from '../../services/restaurants';
import { getCurrentLocation } from '../../services/location';
import RestaurantCard from '../../components/RestaurantCard';
import SortFilterBar from '../../components/SortFilterBar';
import MapViewScreen from './MapViewScreen';
import type { Restaurant } from '../../types';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import NotificationBell from '../../components/NotificationBell';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

const CATEGORIES = [
  { key: 'all',           label: 'Tümü' },
  { key: 'restaurant',    label: 'Restoran' },
  { key: 'meal_takeaway', label: 'Fast Food' },
  { key: 'cafe',          label: 'Kafe' },
];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const {
    loading, error, viewMode,
    setViewMode, setRestaurants, setLoading, setError,
    getSortedFiltered, selectedCategory, setSelectedCategory,
  } = useRestaurantStore();

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

  // Category change is instant — just update store, getSortedFiltered handles filtering
  function handleCategoryPress(key: string) {
    setSelectedCategory(key);
  }

  const restaurants = getSortedFiltered();

  const handlePress = useCallback((restaurant: Restaurant) => {
    navigation.navigate('RestaurantDetail', { placeId: restaurant.placeId });
  }, [navigation]);

  const renderCard = useCallback(({ item }: { item: Restaurant }) => (
    <RestaurantCard restaurant={item} onPress={() => handlePress(item)} />
  ), [handlePress]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>NearEat</Text>
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
        <NotificationBell />
      </View>

      {/* Category Tabs */}
      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORIES.map((cat, i) => {
            const active = selectedCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryTab,
                  active && styles.categoryTabActive,
                  i < CATEGORIES.length - 1 && { marginRight: 8 },
                ]}
                onPress={() => handleCategoryPress(cat.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {viewMode === 'map' ? (
        <MapViewScreen
          restaurants={restaurants}
          onPressRestaurant={handlePress}
          userLat={userCoords?.lat}
          userLng={userCoords?.lng}
        />
      ) : (
        <>
          <SortFilterBar />
          {loading && <ActivityIndicator style={styles.loader} size="large" color={C.primary} />}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!loading && !error && (
            <FlatList
              data={restaurants}
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

    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: C.surface,
    },
    logo: { fontSize: 22, fontWeight: '800', color: C.primary },
    viewToggle: { flexDirection: 'row', backgroundColor: C.surfaceAlt, borderRadius: 8, padding: 2 },
    toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
    toggleActive: { backgroundColor: C.primary },
    toggleText: { fontSize: 13, color: C.textTertiary, fontWeight: '500' },
    toggleTextActive: { color: '#fff' },

    categoryBar: { backgroundColor: C.surface, borderBottomWidth: 1, borderColor: C.separator },
    categoryRow: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
    categoryTab: {
      height: 34, paddingHorizontal: 18, borderRadius: 17,
      borderWidth: 1.5, borderColor: C.disabled, backgroundColor: C.surface,
      justifyContent: 'center', alignItems: 'center',
    },
    categoryTabActive: { backgroundColor: C.primary, borderColor: C.primary },
    categoryLabel: { fontSize: 13, fontWeight: '600', color: C.textSecondary, lineHeight: 18 },
    categoryLabelActive: { color: '#fff' },

    loader: { marginTop: 40 },
    errorText: { textAlign: 'center', color: C.error, marginTop: 40, paddingHorizontal: 16 },
    list: { padding: 16 },
  });
}
