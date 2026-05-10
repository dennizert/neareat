import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, RefreshControl, TextInput, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { useCollectionStore } from '../../store/collectionStore';
import {
  getMyCollections, getSharedWithMe,
  createCollection, deleteCollection,
} from '../../services/collections';
import NotificationBell from '../../components/NotificationBell';
import type { Collection, SharedCollection } from '../../types';

export default function CollectionsScreen() {
  const navigation = useNavigation<any>();
  const { isPremium } = useAuthStore();
  const { myCollections, sharedWithMe, setMyCollections, setSharedWithMe, addCollection, removeCollection } = useCollectionStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'mine' | 'shared'>('mine');

  // Yeni koleksiyon modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPublic, setNewPublic] = useState(false);
  const [creating, setCreating] = useState(false);

  const premium = isPremium();

  async function loadAll() {
    setLoading(true);
    try {
      const [mine, shared] = await Promise.all([
        getMyCollections(),
        getSharedWithMe(),
      ]);
      setMyCollections(mine);
      setSharedWithMe(shared);
    } catch { /* swallow */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  function handleCreatePress() {
    if (!premium) {
      navigation.navigate('Paywall', { trigger: 'collections' });
      return;
    }
    setNewName('');
    setNewDesc('');
    setNewPublic(false);
    setCreateModalVisible(true);
  }

  async function handleCreate() {
    if (!newName.trim()) {
      Alert.alert('Hata', 'Koleksiyon adı zorunludur.');
      return;
    }
    setCreating(true);
    try {
      const col = await createCollection({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        isPublic: newPublic,
      });
      addCollection(col);
      setCreateModalVisible(false);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(col: Collection) {
    Alert.alert('Koleksiyonu Sil', `"${col.name}" silinecek. Devam et?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await deleteCollection(col.id);
            removeCollection(col.id);
          } catch (err: any) {
            Alert.alert('Hata', err.response?.data?.error ?? 'Silinemedi.');
          }
        },
      },
    ]);
  }

  function renderMyCollection({ item: col }: { item: Collection }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('CollectionDetail', { collectionId: col.id, title: col.name })}
        onLongPress={() => handleDelete(col)}
        activeOpacity={0.8}
      >
        <View style={styles.cardIcon}>
          <Text style={{ fontSize: 22 }}>{col.isPublic ? '🌍' : '🔒'}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{col.name}</Text>
          {col.description ? <Text style={styles.cardDesc} numberOfLines={1}>{col.description}</Text> : null}
          <View style={styles.cardMeta}>
            <Text style={styles.cardMetaText}>{col.itemCount} restoran</Text>
            {(col.shareCount ?? 0) > 0 && (
              <Text style={styles.cardMetaText}> · {col.shareCount} paylaşım</Text>
            )}
            <Text style={styles.cardMetaText}> · {col.isPublic ? 'Herkese açık' : 'Gizli'}</Text>
          </View>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  function renderSharedCollection({ item: s }: { item: SharedCollection }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('CollectionDetail', { collectionId: s.collection.id, title: s.collection.name })}
        activeOpacity={0.8}
      >
        <View style={styles.cardIcon}>
          <Text style={{ fontSize: 22 }}>👥</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{s.collection.name}</Text>
          <Text style={styles.cardDesc}>{s.collection.owner.displayName} tarafından paylaşıldı</Text>
          <Text style={styles.cardMetaText}>{s.collection.itemCount} restoran</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Koleksiyonlarım</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <NotificationBell />
          <TouchableOpacity style={styles.createBtn} onPress={handleCreatePress}>
            <Text style={styles.createBtnText}>+ Yeni</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!premium && (
        <TouchableOpacity
          style={styles.premiumBanner}
          onPress={() => navigation.navigate('Paywall', { trigger: 'collections' })}
        >
          <Text style={styles.premiumBannerText}>
            ⭐ Premium özellik — Koleksiyon oluşturmak için Premium'a geç
          </Text>
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'mine' && styles.tabActive]}
          onPress={() => setActiveTab('mine')}
        >
          <Text style={[styles.tabText, activeTab === 'mine' && styles.tabTextActive]}>
            Listelerim ({myCollections.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shared' && styles.tabActive]}
          onPress={() => setActiveTab('shared')}
        >
          <Text style={[styles.tabText, activeTab === 'shared' && styles.tabTextActive]}>
            Benimle Paylaşılan ({sharedWithMe.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#FF6B35" style={{ marginTop: 40 }} />
      ) : activeTab === 'mine' ? (
        <FlatList
          data={myCollections}
          keyExtractor={(c) => c.id}
          renderItem={renderMyCollection}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF6B35" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>Henüz liste yok</Text>
              <Text style={styles.emptyText}>
                {premium
                  ? 'Sağ üstteki "+ Yeni" ile ilk koleksiyonunu oluştur.'
                  : 'Premium üyeler restoran listesi oluşturabilir.'}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={sharedWithMe}
          keyExtractor={(s) => s.shareId}
          renderItem={renderSharedCollection}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF6B35" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>Paylaşılan liste yok</Text>
              <Text style={styles.emptyText}>Arkadaşların koleksiyonlarını seninle paylaşırsa burada görünür.</Text>
            </View>
          }
        />
      )}

      {/* Yeni Koleksiyon Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Text style={styles.modalCancel}>İptal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Yeni Koleksiyon</Text>
            <TouchableOpacity onPress={handleCreate} disabled={creating}>
              {creating
                ? <ActivityIndicator size="small" color="#FF6B35" />
                : <Text style={styles.modalSave}>Kaydet</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Koleksiyon Adı *</Text>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="Örn: Hafta Sonu Brunch"
            placeholderTextColor="#9CA3AF"
            maxLength={100}
            autoFocus
          />

          <Text style={styles.fieldLabel}>Açıklama (opsiyonel)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={newDesc}
            onChangeText={setNewDesc}
            placeholder="Bu liste hakkında kısa bir not..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            maxLength={300}
          />

          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setNewPublic(p => !p)}
          >
            <View>
              <Text style={styles.toggleLabel}>Herkese Açık</Text>
              <Text style={styles.toggleSub}>Açıksa arkadaşların profilinde görebilir</Text>
            </View>
            <View style={[styles.toggle, newPublic && styles.toggleOn]}>
              <View style={[styles.toggleThumb, newPublic && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  createBtn: {
    backgroundColor: '#FF6B35', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  premiumBanner: {
    backgroundColor: '#FFF7ED', padding: 12,
    borderBottomWidth: 1, borderBottomColor: '#FED7AA',
  },
  premiumBannerText: { color: '#92400E', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  tabRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#FF6B35' },
  tabText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  tabTextActive: { color: '#FF6B35', fontWeight: '700' },
  list: { padding: 16, flexGrow: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#F0F4FF',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  cardBody: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  cardDesc: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  cardMeta: { flexDirection: 'row' },
  cardMetaText: { fontSize: 12, color: '#9CA3AF' },
  chevron: { fontSize: 22, color: '#D1D5DB', marginLeft: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff', padding: 20 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 20, borderBottomWidth: 1, borderColor: '#F3F4F6', marginBottom: 20,
  },
  modalCancel: { fontSize: 16, color: '#6B7280' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalSave: { fontSize: 16, color: '#FF6B35', fontWeight: '700' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: '#111827', backgroundColor: '#FAFAFA', marginBottom: 16,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginTop: 4,
  },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  toggleSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  toggle: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: '#E5E7EB', justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: '#FF6B35' },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
