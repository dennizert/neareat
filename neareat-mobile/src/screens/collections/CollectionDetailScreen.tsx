import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Image, Modal,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getCollection, removeFromCollection, shareCollection, unshareCollection } from '../../services/collections';
import { useFriendStore } from '../../store/friendStore';
import { getFriends } from '../../services/social';
import type { Collection, CollectionItem } from '../../types';

export default function CollectionDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { collectionId } = route.params as { collectionId: string; title?: string };

  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const { friends, setFriends } = useFriendStore();

  async function load() {
    try {
      const col = await getCollection(collectionId);
      setCollection(col);
      navigation.setOptions({ title: col.name });
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Koleksiyon yüklenemedi.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [collectionId]);

  async function handleRemoveItem(item: CollectionItem) {
    Alert.alert('Kaldır', `"${item.placeName}" listeden kaldırılsın mı?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Kaldır', style: 'destructive',
        onPress: async () => {
          try {
            await removeFromCollection(collectionId, item.placeId);
            setCollection(prev => prev
              ? { ...prev, items: prev.items?.filter(i => i.placeId !== item.placeId) }
              : prev);
          } catch { Alert.alert('Hata', 'Kaldırılamadı.'); }
        },
      },
    ]);
  }

  async function handleOpenShareModal() {
    setShareModalVisible(true);
    if (friends.length === 0) {
      setLoadingFriends(true);
      const f = await getFriends();
      setFriends(f);
      setLoadingFriends(false);
    }
  }

  async function handleShare(friendId: string, friendName: string) {
    const alreadyShared = collection?.sharedWith?.some(u => u.id === friendId);
    try {
      if (alreadyShared) {
        await unshareCollection(collectionId, friendId);
        setCollection(prev => prev
          ? { ...prev, sharedWith: prev.sharedWith?.filter(u => u.id !== friendId) }
          : prev);
        Alert.alert('Paylaşım Kaldırıldı', `${friendName} artık bu koleksiyonu göremez.`);
      } else {
        await shareCollection(collectionId, friendId);
        const friend = friends.find(f => f.profile.id === friendId);
        if (friend) {
          setCollection(prev => prev
            ? {
                ...prev,
                sharedWith: [...(prev.sharedWith ?? []), {
                  id: friend.profile.id,
                  displayName: friend.profile.displayName,
                  photoUrl: friend.profile.photoUrl,
                }],
              }
            : prev);
        }
        Alert.alert('Paylaşıldı!', `Koleksiyon ${friendName} ile paylaşıldı.`);
      }
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'İşlem başarısız.');
    }
  }

  function renderItem({ item }: { item: CollectionItem }) {
    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => navigation.navigate('RestaurantDetail', { placeId: item.placeId })}
        activeOpacity={0.8}
      >
        {item.placePhotoUrl ? (
          <Image source={{ uri: item.placePhotoUrl }} style={styles.itemPhoto} />
        ) : (
          <View style={[styles.itemPhoto, styles.itemPhotoPlaceholder]}>
            <Text style={{ fontSize: 22 }}>🍽️</Text>
          </View>
        )}
        <View style={styles.itemBody}>
          <Text style={styles.itemName} numberOfLines={1}>{item.placeName}</Text>
          {item.placeAddress ? (
            <Text style={styles.itemAddress} numberOfLines={1}>{item.placeAddress}</Text>
          ) : null}
          {item.note ? (
            <Text style={styles.itemNote}>"{item.note}"</Text>
          ) : null}
          {item.placeRating ? (
            <Text style={styles.itemRating}>★ {Number(item.placeRating).toFixed(1)}</Text>
          ) : null}
        </View>
        {collection?.isOwner && (
          <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveItem(item)}>
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} color="#FF6B35" size="large" />;
  }

  if (!collection) return null;

  const sharedWithIds = new Set((collection.sharedWith ?? []).map(u => u.id));

  return (
    <View style={styles.container}>
      {/* Koleksiyon başlığı */}
      <View style={styles.collectionHeader}>
        <View style={styles.collectionHeaderLeft}>
          <Text style={styles.collectionIcon}>{collection.isPublic ? '🌍' : '🔒'}</Text>
          <View>
            <Text style={styles.collectionName}>{collection.name}</Text>
            {collection.description ? (
              <Text style={styles.collectionDesc}>{collection.description}</Text>
            ) : null}
            <Text style={styles.collectionMeta}>
              {collection.items?.length ?? 0} restoran
              {!collection.isOwner && collection.owner
                ? ` · ${collection.owner.displayName}'ın listesi`
                : ''}
            </Text>
          </View>
        </View>

        {collection.isOwner && (
          <TouchableOpacity style={styles.shareBtn} onPress={handleOpenShareModal}>
            <Text style={styles.shareBtnText}>👥 Paylaş</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Paylaşılan kişiler */}
      {collection.isOwner && (collection.sharedWith?.length ?? 0) > 0 && (
        <View style={styles.sharedWithRow}>
          <Text style={styles.sharedWithLabel}>Paylaşıldı: </Text>
          {collection.sharedWith?.map(u => (
            <Text key={u.id} style={styles.sharedWithName}>{u.displayName}</Text>
          ))}
        </View>
      )}

      <FlatList
        data={collection.items ?? []}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>Henüz restoran yok</Text>
            <Text style={styles.emptyText}>
              Herhangi bir restoran detayından "📋 Liste" butonuyla ekleyebilirsin.
            </Text>
          </View>
        }
      />

      {/* Arkadaşlarla paylaşma modal */}
      <Modal
        visible={shareModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShareModalVisible(false)}>
              <Text style={styles.modalClose}>Kapat</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Arkadaşlarla Paylaş</Text>
            <View style={{ width: 60 }} />
          </View>

          {loadingFriends ? (
            <ActivityIndicator color="#FF6B35" style={{ marginTop: 40 }} />
          ) : friends.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Henüz arkadaşın yok.</Text>
            </View>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(f) => f.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item: f }) => {
                const alreadyShared = sharedWithIds.has(f.profile.id);
                return (
                  <TouchableOpacity
                    style={[styles.friendRow, alreadyShared && styles.friendRowShared]}
                    onPress={() => handleShare(f.profile.id, f.profile.displayName)}
                  >
                    <View style={styles.friendAvatar}>
                      {f.profile.photoUrl
                        ? <Image source={{ uri: f.profile.photoUrl }} style={styles.friendAvatarImg} />
                        : <Text>{f.profile.displayName.charAt(0)}</Text>}
                    </View>
                    <Text style={styles.friendName}>{f.profile.displayName}</Text>
                    <View style={[styles.friendToggle, alreadyShared && styles.friendToggleOn]}>
                      <Text style={styles.friendToggleText}>{alreadyShared ? '✓ Paylaşıldı' : '+ Paylaş'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  collectionHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  collectionHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  collectionIcon: { fontSize: 28, marginRight: 12 },
  collectionName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  collectionDesc: { fontSize: 13, color: '#6B7280', marginTop: 2, marginBottom: 2 },
  collectionMeta: { fontSize: 12, color: '#9CA3AF' },
  shareBtn: {
    backgroundColor: '#4F46E5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sharedWithRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    backgroundColor: '#EEF2FF', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#E0E7FF',
  },
  sharedWithLabel: { fontSize: 12, color: '#4F46E5', fontWeight: '600' },
  sharedWithName: {
    fontSize: 12, color: '#4F46E5', backgroundColor: '#E0E7FF',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6, marginBottom: 2,
  },
  list: { padding: 16, flexGrow: 1 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  itemPhoto: { width: 72, height: 72 },
  itemPhotoPlaceholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1, padding: 12 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  itemAddress: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  itemNote: { fontSize: 12, color: '#6B7280', fontStyle: 'italic', marginBottom: 2 },
  itemRating: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
  removeBtn: {
    padding: 12, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { fontSize: 16, color: '#EF4444' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalClose: { fontSize: 16, color: '#6B7280' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  friendRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  friendRowShared: { backgroundColor: '#F0F4FF', borderRadius: 10, paddingHorizontal: 8 },
  friendAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFE8DF',
    alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden',
  },
  friendAvatarImg: { width: 40, height: 40 },
  friendName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  friendToggle: {
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#4F46E5',
  },
  friendToggleOn: { backgroundColor: '#D1FAE5' },
  friendToggleText: { fontSize: 13, fontWeight: '600', color: '#fff' },
});
