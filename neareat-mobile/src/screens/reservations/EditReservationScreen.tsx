import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getReservationDetail, updateReservation } from '../../services/reservations';
import type { Reservation } from '../../types';
import { reservationRestaurantName } from '../../utils/reservationName';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

const OCCASIONS = ['', 'Doğum Günü', 'Yıl Dönümü', 'İş Yemeği', 'Arkadaş Buluşması', 'Aile Yemeği', 'Diğer'];

const TIMES = [
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
];

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

function getNextDays(count: number): string[] {
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return days;
}

export default function EditReservationScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { reservationId } = route.params;
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loadingReservation, setLoadingReservation] = useState(true);

  const days = getNextDays(60);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [guestCount, setGuestCount] = useState('2');
  const [occasion, setOccasion] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getReservationDetail(reservationId)
      .then(res => {
        setReservation(res);
        setSelectedDate(days.includes(res.date) ? res.date : days[0]);
        setSelectedTime(res.time);
        setGuestCount(String(res.guestCount));
        setOccasion(res.occasion ?? '');
        setSpecialRequests(res.specialRequests ?? '');
      })
      .catch(() => Alert.alert('Hata', 'Rezervasyon yüklenemedi.'))
      .finally(() => setLoadingReservation(false));
  }, []);

  async function handleSubmit() {
    if (!selectedDate) return Alert.alert('Hata', 'Lütfen bir tarih seçin.');
    if (!selectedTime) return Alert.alert('Hata', 'Lütfen bir saat seçin.');
    const guests = parseInt(guestCount);
    if (isNaN(guests) || guests < 1 || guests > 50) {
      return Alert.alert('Hata', 'Misafir sayısı 1 ile 50 arasında olmalıdır.');
    }

    setSubmitting(true);
    try {
      await updateReservation(reservationId, {
        date: selectedDate,
        time: selectedTime,
        guestCount: guests,
        occasion: occasion || undefined,
        specialRequests: specialRequests.trim() || undefined,
      });
      Alert.alert(
        '✅ Rezervasyon Güncellendi',
        'Eski rezervasyonunuz iptal edildi ve yeni talebiniz restorana gönderildi. Onay bekleniyor.',
        [{ text: 'Tamam', onPress: () => navigation.navigate('MyReservations') }],
      );
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Rezervasyon güncellenemedi.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingReservation) return <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="large" />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Rezervasyonu Güncelle</Text>
        </View>

        {reservation && (
          <View style={styles.restaurantBadge}>
            <Text style={styles.restaurantName}>🍽️ {reservationRestaurantName(reservation)}</Text>
            <Text style={styles.updateNote}>
              ⚠️ Güncelleme yapıldığında mevcut rezervasyonunuz iptal edilerek yeni talep oluşturulur ve restoran onayı beklenir.
            </Text>
          </View>
        )}

        {/* Tarih Seçimi */}
        <Text style={styles.sectionLabel}>Tarih</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {days.map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.chip, selectedDate === d && styles.chipActive]}
              onPress={() => setSelectedDate(d)}
            >
              <Text style={[styles.chipText, selectedDate === d && styles.chipTextActive]}>
                {formatDateDisplay(d)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Saat Seçimi */}
        <Text style={styles.sectionLabel}>Saat</Text>
        <View style={styles.timeGrid}>
          {TIMES.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.timeChip, selectedTime === t && styles.timeChipActive]}
              onPress={() => setSelectedTime(t)}
            >
              <Text style={[styles.timeChipText, selectedTime === t && styles.timeChipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Misafir Sayısı */}
        <Text style={styles.sectionLabel}>Misafir Sayısı</Text>
        <View style={styles.counterRow}>
          <TouchableOpacity
            style={styles.counterBtn}
            onPress={() => setGuestCount(g => String(Math.max(1, parseInt(g) - 1)))}
          >
            <Text style={styles.counterBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.counterValue}>{guestCount} kişi</Text>
          <TouchableOpacity
            style={styles.counterBtn}
            onPress={() => setGuestCount(g => String(Math.min(50, parseInt(g) + 1)))}
          >
            <Text style={styles.counterBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Özel Durum */}
        <Text style={styles.sectionLabel}>Özel Durum (isteğe bağlı)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {OCCASIONS.map(o => (
            <TouchableOpacity
              key={o}
              style={[styles.chip, occasion === o && styles.chipActive]}
              onPress={() => setOccasion(o)}
            >
              <Text style={[styles.chipText, occasion === o && styles.chipTextActive]}>
                {o || 'Yok'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Özel İstek */}
        <Text style={styles.sectionLabel}>Özel İstek / Not (isteğe bağlı)</Text>
        <TextInput
          style={styles.textArea}
          value={specialRequests}
          onChangeText={setSpecialRequests}
          placeholder="Örn: Pencere kenarı masa, alerjim var..."
          placeholderTextColor={C.textMuted}
          multiline
          numberOfLines={3}
          maxLength={500}
        />

        {/* Gönder Butonu */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>📅 Güncellemeyi Gönder</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 16,
      paddingBottom: 12, backgroundColor: C.surface,
      borderBottomWidth: 1, borderBottomColor: C.separator,
    },
    backBtn: { marginRight: 12, padding: 4 },
    backText: { fontSize: 28, color: C.primary, lineHeight: 32 },
    title: { fontSize: 18, fontWeight: '700', color: C.textPrimary, flex: 1 },
    restaurantBadge: {
      margin: 16, backgroundColor: C.primaryLight, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: C.primary, gap: 8,
    },
    restaurantName: { fontSize: 15, fontWeight: '600', color: C.primary },
    updateNote: { fontSize: 12, color: C.warning, lineHeight: 18 },
    sectionLabel: { fontSize: 13, fontWeight: '600', color: C.textTertiary, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
    chipScroll: { paddingHorizontal: 16 },
    chip: {
      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
      backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
    },
    chipActive: { backgroundColor: C.primary, borderColor: C.primary },
    chipText: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
    chipTextActive: { color: '#fff' },
    timeGrid: {
      flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8,
    },
    timeChip: {
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
      backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
      minWidth: 64, alignItems: 'center',
    },
    timeChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    timeChipText: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
    timeChipTextActive: { color: '#fff' },
    counterRow: {
      flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, gap: 16,
    },
    counterBtn: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    counterBtnText: { fontSize: 24, color: '#fff', lineHeight: 28 },
    counterValue: { fontSize: 17, fontWeight: '700', color: C.textPrimary, minWidth: 80, textAlign: 'center' },
    textArea: {
      marginHorizontal: 16, backgroundColor: C.surface, borderRadius: 12, padding: 12,
      borderWidth: 1, borderColor: C.border, fontSize: 14, color: C.textPrimary,
      minHeight: 80, textAlignVertical: 'top',
    },
    submitBtn: {
      margin: 16, marginTop: 24, backgroundColor: C.primary, borderRadius: 14,
      paddingVertical: 16, alignItems: 'center',
    },
    submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  });
}
