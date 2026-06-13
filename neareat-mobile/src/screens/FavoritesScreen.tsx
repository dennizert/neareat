import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { useFavoriteStore } from '../store/favoriteStore';
import { fetchFavorites } from '../services/favorites';
import { getCurrentLocation } from '../services/location';
import { haversineKm } from '../utils/haversine';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RestaurantCard from '../components/RestaurantCard';
import NotificationBell from '../components/NotificationBell';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import type { Favorite } from '../types';
import { useTheme } from '../theme';
import type { Colors } from '../theme';
import { listPerf } from '../theme/listPerf';

export default function FavoritesScreen() {
  const navigation = useNavigation<any>();
  const { favorites, setFavorites } = useFavoriteStore();
  const insets = useSafeAreaInsets();
  const { bottom } = insets;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  const { C, isDark } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    const [favs, coords] = await Promise.allSettled([
      fetchFavorites(),
      getCurrentLocation(),
    ]);
    if (favs.status === 'fulfilled') setFavorites(favs.value);
    else setError(true); // favori listesi çekilemedi → hata durumu
    if (coords.status === 'fulfilled') {
      setUserLat(coords.value.lat);
      setUserLng(coords.value.lng);
    }
    setLoading(false);
  }, [setFavorites]);

  useEffect(() => { load(); }, [load]);

  function handlePress(fav: Favorite) {
    navigation.navigate('RestaurantDetail', { placeId: fav.placeId });
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.header}>Favoriler</Text>
          <NotificationBell />
        </View>
        <View style={styles.list}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={styles.skelRow}>
              <Skeleton width={104} height={104} radius={0} />
              <View style={styles.skelBody}>
                <Skeleton width="70%" height={15} />
                <Skeleton width="45%" height={11} />
                <Skeleton width="35%" height={11} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.header}>Favoriler</Text>
        <NotificationBell />
      </View>
      {error ? (
        <ErrorState message="Favorilerin yüklenemedi." onRetry={load} />
      ) : favorites.length === 0 ? (
        <EmptyState
          icon="heartOutline"
          title="Henüz favorin yok"
          description="Beğendiğin mekanları favorile, hepsi burada toplansın."
          actionLabel="Keşfet'e git"
          onAction={() => navigation.navigate('Home')}
        />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(f) => f.placeId}
          renderItem={({ item }) => {
            const distanceKm =
              userLat != null && userLng != null
                ? haversineKm(userLat, userLng, Number(item.placeLat), Number(item.placeLng))
                : 0;
            return (
              <RestaurantCard
                restaurant={{
                  placeId: item.placeId,
                  name: item.displayName ?? item.placeName,
                  rating: item.placeRating ?? 0,
                  userRatingsTotal: 0,
                  priceLevel: null,
                  types: [],
                  isOpenNow: null,
                  location: { lat: Number(item.placeLat), lng: Number(item.placeLng) },
                  distanceKm,
                  photoUrl: item.placePhotoUrl,
                }}
                onPress={() => handlePress(item)}
              />
            );
          }}
          contentContainerStyle={[styles.list, { paddingBottom: bottom + 16 }]}
          {...listPerf}
        />
      )}
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, backgroundColor: C.surface },
    header: { fontSize: 22, fontWeight: '700', color: C.textPrimary },
    list: { padding: 16 },
    skelRow: {
      flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, marginBottom: 12,
      overflow: 'hidden', borderWidth: 1, borderColor: C.border,
    },
    skelBody: { flex: 1, padding: 12, justifyContent: 'center', gap: 8 },
  });
}
