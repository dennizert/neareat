import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFavoriteStore } from '../store/favoriteStore';
import { fetchFavorites } from '../services/favorites';
import { getCurrentLocation } from '../services/location';
import { haversineKm } from '../utils/haversine';
import { useNavigation } from '@react-navigation/native';
import RestaurantCard from '../components/RestaurantCard';
import NotificationBell from '../components/NotificationBell';
import type { Favorite } from '../types';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

export default function FavoritesScreen() {
  const navigation = useNavigation<any>();
  const { favorites, setFavorites } = useFavoriteStore();
  const [loading, setLoading] = useState(true);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  const { C, isDark } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    async function load() {
      const [favs, coords] = await Promise.allSettled([
        fetchFavorites(),
        getCurrentLocation(),
      ]);
      if (favs.status === 'fulfilled') setFavorites(favs.value);
      if (coords.status === 'fulfilled') {
        setUserLat(coords.value.lat);
        setUserLng(coords.value.lng);
      }
      setLoading(false);
    }
    load();
  }, []);

  function handlePress(fav: Favorite) {
    navigation.navigate('RestaurantDetail', { placeId: fav.placeId });
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={C.primary} />;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Favoriler</Text>
        <NotificationBell />
      </View>
      {favorites.length === 0 ? (
        <Text style={styles.empty}>Henüz favori eklemediniz.</Text>
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
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, backgroundColor: C.surface },
    header: { fontSize: 22, fontWeight: '700', color: C.textPrimary },
    empty: { textAlign: 'center', color: C.textMuted, marginTop: 60, fontSize: 16 },
    list: { padding: 16 },
  });
}
