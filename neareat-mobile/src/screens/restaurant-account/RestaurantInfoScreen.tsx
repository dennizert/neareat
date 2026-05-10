import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getMyRestaurantProfile, updateInfo } from '../../services/restaurantAccount';

export default function RestaurantInfoScreen() {
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [address, setAddress] = useState('');
  const [reservationUrl, setReservationUrl] = useState('');

  useEffect(() => {
    getMyRestaurantProfile()
      .then(p => {
        setPhone(p.phone ?? '');
        setContactEmail(p.contactEmail ?? '');
        setAddress(p.address ?? '');
        setReservationUrl(p.reservationUrl ?? '');
      })
      .catch(() => Alert.alert('Hata', 'Bilgiler yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!phone.trim()) {
      Alert.alert('Hata', 'Telefon numarası boş bırakılamaz.');
      return;
    }
    if (!contactEmail.trim() || !contactEmail.includes('@')) {
      Alert.alert('Hata', 'Geçerli bir e-posta girin.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Hata', 'Adres boş bırakılamaz.');
      return;
    }

    setSaving(true);
    try {
      await updateInfo({
        phone: phone.trim(),
        contactEmail: contactEmail.trim(),
        address: address.trim(),
        reservationUrl: reservationUrl.trim() || undefined,
      });
      Alert.alert('Kaydedildi', 'İletişim bilgileriniz güncellendi.', [
        { text: 'Tamam', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#FF6B35" size="large" />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>İletişim Bilgileri</Text>
        <View style={styles.card}>
          <Field label="Telefon Numarası">
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+90 555 000 00 00"
              placeholderTextColor="#9CA3AF"
            />
          </Field>
          <Field label="İletişim E-postası">
            <TextInput
              style={styles.input}
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="isletme@ornek.com"
              placeholderTextColor="#9CA3AF"
            />
          </Field>
          <Field label="Adres" last>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              placeholder="Mahalle, sokak, bina..."
              placeholderTextColor="#9CA3AF"
            />
          </Field>
        </View>

        <Text style={styles.sectionLabel}>Rezervasyon</Text>
        <View style={styles.card}>
          <Field label="Rezervasyon URL" last>
            <TextInput
              style={styles.input}
              value={reservationUrl}
              onChangeText={setReservationUrl}
              keyboardType="url"
              autoCapitalize="none"
              placeholder="https://rezervasyon.siteniz.com"
              placeholderTextColor="#9CA3AF"
            />
          </Field>
        </View>
        <Text style={styles.hint}>
          Rezervasyon URL'si girildiğinde restoran detay sayfasında "Rezervasyon" butonu görünür.
        </Text>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Kaydet</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.field, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  body: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    overflow: 'hidden',
  },
  field: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    fontSize: 15, color: '#111827',
    paddingVertical: 0,
  },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: '#9CA3AF', lineHeight: 18, marginBottom: 24 },
  saveBtn: {
    backgroundColor: '#FF6B35', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
