import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { getMyRestaurantReviews, replyToReview, deleteReply } from '../../services/restaurantAccount';
import type { AppReview } from '../../types';

function StarRow({ rating }: { rating: number }) {
  return <Text style={styles.stars}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</Text>;
}

export default function RestaurantReviewsScreen() {
  const [reviews, setReviews] = useState<AppReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyModal, setReplyModal] = useState<{ reviewId: string; existing: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyRestaurantReviews().then(setReviews).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function openReply(review: AppReview) {
    setReplyText(review.reply?.content ?? '');
    setReplyModal({ reviewId: review.id, existing: review.reply?.content ?? '' });
  }

  async function handleSaveReply() {
    if (!replyModal || !replyText.trim()) return;
    setSaving(true);
    try {
      const reply = await replyToReview(replyModal.reviewId, replyText.trim());
      setReviews(prev => prev.map(r =>
        r.id === replyModal.reviewId ? { ...r, reply } : r
      ));
      setReplyModal(null);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteReply(reviewId: string) {
    Alert.alert('Cevabı Sil', 'Cevabınız silinecek. Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await deleteReply(reviewId);
            setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reply: null } : r));
          } catch { Alert.alert('Hata', 'Silinemedi.'); }
        },
      },
    ]);
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#FF6B35" size="large" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={reviews}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Henüz yorum yok</Text>
            <Text style={styles.emptyText}>Kullanıcılar restoranınızı değerlendirdiğinde burada görünür.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewUser}>{item.user.displayName}</Text>
              <Text style={styles.reviewDate}>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</Text>
            </View>
            <StarRow rating={item.rating} />
            <Text style={styles.reviewBody}>{item.body}</Text>

            {item.reply ? (
              <View style={styles.replyBox}>
                <Text style={styles.replyLabel}>İşletme Yanıtı</Text>
                <Text style={styles.replyContent}>{item.reply.content}</Text>
                <View style={styles.replyActions}>
                  <TouchableOpacity onPress={() => openReply(item)}>
                    <Text style={styles.replyEdit}>Düzenle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteReply(item.id)}>
                    <Text style={styles.replyDelete}>Sil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.replyBtn} onPress={() => openReply(item)}>
                <Text style={styles.replyBtnText}>💬 Yanıt Yaz</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      <Modal visible={!!replyModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setReplyModal(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReplyModal(null)}>
              <Text style={styles.modalClose}>İptal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Yanıt Yaz</Text>
            <TouchableOpacity onPress={handleSaveReply} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#FF6B35" /> : <Text style={styles.modalSave}>Kaydet</Text>}
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.replyInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Müşteriye yanıtınızı yazın... (max 500 karakter)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={6}
            maxLength={500}
            autoFocus
          />
          <Text style={styles.charCount}>{replyText.length}/500</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  list: { padding: 16, paddingBottom: 32 },
  reviewCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, elevation: 2,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reviewUser: { fontSize: 14, fontWeight: '700', color: '#111827' },
  reviewDate: { fontSize: 12, color: '#9CA3AF' },
  stars: { fontSize: 14, color: '#F59E0B', marginBottom: 6 },
  reviewBody: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 10 },
  replyBox: { backgroundColor: '#F0F9FF', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: '#0EA5E9' },
  replyLabel: { fontSize: 11, fontWeight: '700', color: '#0369A1', marginBottom: 4 },
  replyContent: { fontSize: 13, color: '#0C4A6E', lineHeight: 18 },
  replyActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  replyEdit: { fontSize: 12, color: '#0EA5E9', fontWeight: '600' },
  replyDelete: { fontSize: 12, color: '#EF4444', fontWeight: '600' },
  replyBtn: {
    backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 8,
    paddingHorizontal: 14, alignSelf: 'flex-start',
  },
  replyBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 24 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff', padding: 20 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalClose: { fontSize: 16, color: '#6B7280' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalSave: { fontSize: 16, color: '#FF6B35', fontWeight: '700' },
  replyInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 14, fontSize: 15, color: '#111827', minHeight: 140,
    textAlignVertical: 'top', backgroundColor: '#FAFAFA',
  },
  charCount: { textAlign: 'right', fontSize: 12, color: '#9CA3AF', marginTop: 6 },
});
