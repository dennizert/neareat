import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, FlatList,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  getReservationDetail, getReservationMessages,
  sendReservationMessage, cancelReservation,
} from '../../services/reservations';
import { useAuthStore } from '../../store/authStore';
import type { Reservation, ReservationMessage } from '../../types';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: 'Bekliyor',   color: '#92400E', bg: '#FEF3C7' },
  CONFIRMED: { label: 'Onaylandı',  color: '#065F46', bg: '#D1FAE5' },
  REJECTED:  { label: 'Reddedildi', color: '#991B1B', bg: '#FEE2E2' },
  CANCELLED: { label: 'İptal',      color: '#374151', bg: '#F3F4F6' },
  COMPLETED: { label: 'Tamamlandı', color: '#1E3A8A', bg: '#EFF6FF' },
};

export default function ReservationDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { reservationId } = route.params;
  const { user } = useAuthStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [messages, setMessages] = useState<ReservationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const reminderShown = useRef(false);

  async function load() {
    try {
      const [res, msgs] = await Promise.all([
        getReservationDetail(reservationId),
        getReservationMessages(reservationId),
      ]);
      setReservation(res);
      setMessages(msgs);
      return res;
    } catch { /* swallow */ } finally {
      setLoading(false);
    }
  }

  function showReminderAlert(res: Reservation) {
    Alert.alert(
      '📅 Rezervasyon Hatırlatması',
      `Bugün saat ${res.time}'de ${res.restaurant.businessName} rezervasyonunuz bulunmaktadır. Katılım durumunuzu belirtebilir misiniz?`,
      [
        {
          text: 'Hayır, katılamayacağım. İptal etmek istiyorum.',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelReservation(res.id);
              setReservation(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
              Alert.alert('Rezervasyon İptal Edildi', 'Rezervasyonunuz iptal edildi ve restoran bilgilendirildi.');
            } catch (err: any) {
              Alert.alert('Hata', err.response?.data?.error ?? 'İptal edilemedi.');
            }
          },
        },
        { text: 'Evet, katılacağım.', style: 'default' },
      ],
    );
  }

  useEffect(() => {
    load().then(res => {
      if (!res || reminderShown.current) return;
      if (res.status === 'CONFIRMED' && res.date === getTodayString()) {
        reminderShown.current = true;
        setTimeout(() => showReminderAlert(res), 600);
      }
    });
  }, []);

  async function handleSend() {
    const text = msgText.trim();
    if (!text) return;
    setSending(true);
    try {
      const msg = await sendReservationMessage(reservationId, text);
      setMessages(prev => [...prev, msg]);
      setMsgText('');
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Mesaj gönderilemedi.');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="large" />;
  if (!reservation) return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>Rezervasyon bulunamadı.</Text>
    </View>
  );

  const st = STATUS_LABELS[reservation.status] ?? STATUS_LABELS.PENDING;
  const isUserRole = user?.id === reservation.userId;

  function renderMessage({ item }: { item: ReservationMessage }) {
    const isMine = item.senderId === user?.id;
    return (
      <View style={[styles.msgBubble, isMine ? styles.msgMine : styles.msgOther]}>
        {!isMine && (
          <Text style={styles.msgRole}>
            {item.senderRole === 'RESTAURANT' ? '🍽️ Restoran' : '👤 ' + reservation!.user.displayName}
          </Text>
        )}
        <Text style={[styles.msgText, isMine ? styles.msgTextMine : styles.msgTextOther]}>{item.content}</Text>
        <Text style={[styles.msgTime, isMine ? styles.msgTimeMine : styles.msgTimeOther]}>
          {new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  }

  const canChat = ['PENDING', 'CONFIRMED'].includes(reservation.status);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rezervasyon Detayı</Text>
        </View>

        <ScrollView style={styles.detailSection} contentContainerStyle={{ paddingBottom: 8 }}>
          {/* Restoran + Durum */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.restaurantName}>{reservation.restaurant.businessName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
              </View>
            </View>
            <Text style={styles.infoLine}>📅 {reservation.date}   🕐 {reservation.time}</Text>
            <Text style={styles.infoLine}>👥 {reservation.guestCount} kişi{reservation.occasion ? `   •   ${reservation.occasion}` : ''}</Text>
            {reservation.specialRequests ? (
              <Text style={styles.infoLine}>📝 {reservation.specialRequests}</Text>
            ) : null}
            {reservation.status === 'REJECTED' && reservation.rejectionReason && (
              <Text style={styles.rejectionText}>❌ Red nedeni: {reservation.rejectionReason}</Text>
            )}
            {isUserRole && reservation.attended === true && (
              <Text style={styles.attendedText}>✅ Katılım onaylandı — +20 yıldız kazandınız!</Text>
            )}
            {isUserRole && reservation.attended === false && (
              <Text style={styles.noShowText}>⚠️ Katılım sağlanamadı — 10 yıldız düşüldü.</Text>
            )}
          </View>

          {/* Sohbet Başlığı */}
          {messages.length > 0 && (
            <Text style={styles.chatLabel}>💬 Rezervasyon Sohbeti</Text>
          )}
        </ScrollView>

        {/* Mesajlar */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          style={styles.msgList}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          ListEmptyComponent={
            <Text style={styles.noMsgText}>Henüz mesaj yok. Rezervasyon hakkında mesaj gönderebilirsiniz.</Text>
          }
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Mesaj Giriş Alanı */}
        {canChat && (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.msgInput}
              value={msgText}
              onChangeText={setMsgText}
              placeholder="Mesaj yaz..."
              placeholderTextColor={C.textMuted}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!msgText.trim() || sending) && { opacity: 0.5 }]}
              onPress={handleSend}
              disabled={!msgText.trim() || sending}
            >
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendBtnText}>▶</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: C.textTertiary },
    header: {
      flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16,
      paddingBottom: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.separator,
    },
    backBtn: { marginRight: 12, padding: 4 },
    backText: { fontSize: 28, color: C.primary, lineHeight: 32 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary },
    detailSection: { flexGrow: 0, backgroundColor: C.surface },
    infoCard: { padding: 16, borderBottomWidth: 1, borderBottomColor: C.separator },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    restaurantName: { fontSize: 16, fontWeight: '700', color: C.textPrimary, flex: 1, marginRight: 8 },
    statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
    statusText: { fontSize: 12, fontWeight: '600' },
    infoLine: { fontSize: 14, color: C.textSecondary, marginBottom: 4 },
    rejectionText: { fontSize: 13, color: '#DC2626', fontStyle: 'italic', marginTop: 6 },
    attendedText: { fontSize: 13, color: '#065F46', fontWeight: '600', marginTop: 6 },
    noShowText: { fontSize: 13, color: '#DC2626', fontWeight: '600', marginTop: 6 },
    chatLabel: { paddingHorizontal: 16, paddingVertical: 10, fontSize: 13, fontWeight: '600', color: C.textTertiary },
    msgList: { flex: 1, backgroundColor: C.background },
    msgBubble: { maxWidth: '78%', marginBottom: 10, borderRadius: 14, padding: 10 },
    msgMine: { alignSelf: 'flex-end', backgroundColor: C.primary },
    msgOther: { alignSelf: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
    msgRole: { fontSize: 10, color: C.textTertiary, marginBottom: 2 },
    msgText: { fontSize: 14 },
    msgTextMine: { color: '#fff' },
    msgTextOther: { color: C.textPrimary },
    msgTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },
    msgTimeMine: { color: 'rgba(255,255,255,0.7)' },
    msgTimeOther: { color: C.textMuted },
    noMsgText: { textAlign: 'center', color: C.textMuted, fontSize: 13, padding: 20 },
    inputBar: {
      flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10,
      backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.separator, gap: 8,
      paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    },
    msgInput: {
      flex: 1, backgroundColor: C.inputBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
      fontSize: 14, color: C.textPrimary, maxHeight: 100,
    },
    sendBtn: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
}
