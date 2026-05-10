import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getMyRestaurantProfile, uploadMenuItem, deleteMenuItem } from '../../services/restaurantAccount';
import type { RestaurantMenuItemMeta } from '../../types';

export default function RestaurantMenuScreen() {
  const [items, setItems] = useState<RestaurantMenuItemMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getMyRestaurantProfile().then(p => {
      setItems(p.menuItems ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleUpload() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const data = `data:${mimeType};base64,${asset.base64}`;
    const fileName = asset.fileName ?? `menu_${Date.now()}.jpg`;

    setUploading(true);
    try {
      const item = await uploadMenuItem({ data, mimeType, fileName });
      setItems(prev => [...prev, item]);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Yükleme başarısız.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item: RestaurantMenuItemMeta) {
    Alert.alert('Menü Öğesini Sil', 'Bu sayfa menüden kaldırılsın mı?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await deleteMenuItem(item.id);
            setItems(prev => prev.filter(i => i.id !== item.id));
          } catch { Alert.alert('Hata', 'Silinemedi.'); }
        },
      },
    ]);
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#FF6B35" size="large" />;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.hint}>Menü sayfalarınızı yükleyin. Premium kullanıcılar restoran detayında görüntüleyebilir.</Text>
        <TouchableOpacity
          style={[styles.uploadBtn, (uploading || items.length >= 10) && { opacity: 0.5 }]}
          onPress={handleUpload}
          disabled={uploading || items.length >= 10}
        >
          {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.uploadBtnText}>+ Fotoğraf Ekle</Text>}
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Henüz menü yok</Text>
          <Text style={styles.emptyText}>Menü sayfalarınızın fotoğraflarını yükleyin.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <View style={styles.gridItemImg}>
                {item.data ? (
                  <Image source={{ uri: item.data }} style={styles.gridItemPhoto} resizeMode="cover" />
                ) : (
                  <Text style={{ fontSize: 32 }}>🖼️</Text>
                )}
              </View>
              <Text style={styles.gridItemName} numberOfLines={1}>{item.fileName ?? 'Menü'}</Text>
              <Text style={styles.gridItemDate}>{new Date(item.uploadedAt).toLocaleDateString('tr-TR')}</Text>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Text style={styles.deleteBtnText}>Sil</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 10 },
  hint: { fontSize: 12, color: '#6B7280', lineHeight: 18 },
  uploadBtn: { backgroundColor: '#FF6B35', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  grid: { padding: 16, gap: 10 },
  gridItem: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, elevation: 2,
  },
  gridItemImg: { width: '100%', aspectRatio: 1, backgroundColor: '#F3F4F6', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' },
  gridItemPhoto: { width: '100%', height: '100%', borderRadius: 10 },
  gridItemName: { fontSize: 11, color: '#6B7280', textAlign: 'center', marginBottom: 2 },
  gridItemDate: { fontSize: 11, color: '#9CA3AF', marginBottom: 6 },
  deleteBtn: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  deleteBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 12 },
});
