import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { getMyRestaurantReviews, replyToReview, deleteReply } from '../../services/restaurantAccount';
import type { AppReview } from '../../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

function StarRow({ rating, styles }: { rating: number; styles: ReturnType<typeof makeStyles> }) {
  return <Text style={styles.stars}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</Text>;
}

export default function RestaurantReviewsScreen() {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();

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

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="large" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={reviews}
        keyExtractor={r => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottom + 16 }]}
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
            <StarRow rating={item.rating} styles={styles} />
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
              {saving ? <ActivityIndicator size="small" color={C.primary} /> : <Text style={styles.modalSave}>Kaydet</Text>}
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.replyInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Müşteriye yanıtınızı yazın... (max 500 karakter)"
            placeholderTextColor={C.textMuted}
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

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    list: { padding: 16, paddingBottom: 32 },
    reviewCard: {
      backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10,
      shadowColor: C.shadow, shadowOpacity: 0.05, elevation: 2,
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    reviewUser: { fontSize: 14, fontWeight: '700', color: C.textPrimary },
    reviewDate: { fontSize: 12, color: C.textMuted },
    stars: { fontSize: 14, color: C.warning, marginBottom: 6 },
    reviewBody: { fontSize: 14, color: C.textSecondary, lineHeight: 20, marginBottom: 10 },
    replyBox: { backgroundColor: C.travelSurface, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: C.travel },
    replyLabel: { fontSize: 11, fontWeight: '700', color: C.travel, marginBottom: 4 },
    replyContent: { fontSize: 13, color: C.textPrimary, lineHeight: 18 },
    replyActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
    replyEdit: { fontSize: 12, color: C.travel, fontWeight: '600' },
    replyDelete: { fontSize: 12, color: C.error, fontWeight: '600' },
    replyBtn: {
      backgroundColor: C.inputBg, borderRadius: 8, paddingVertical: 8,
      paddingHorizontal: 14, alignSelf: 'flex-start',
    },
    replyBtnText: { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
    empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: C.textSecondary, marginBottom: 6 },
    emptyText: { fontSize: 13, color: C.textMuted, textAlign: 'center', paddingHorizontal: 24 },
    // Modal
    modalContainer: { flex: 1, backgroundColor: C.surface, padding: 20 },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.separator,
    },
    modalClose: { fontSize: 16, color: C.textTertiary },
    modalTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary },
    modalSave: { fontSize: 16, color: C.primary, fontWeight: '700' },
    replyInput: {
      borderWidth: 1, borderColor: C.border, borderRadius: 12,
      padding: 14, fontSize: 15, color: C.textPrimary, minHeight: 140,
      textAlignVertical: 'top', backgroundColor: C.inputBg,
    },
    charCount: { textAlign: 'right', fontSize: 12, color: C.textMuted, marginTop: 6 },
  });
}
