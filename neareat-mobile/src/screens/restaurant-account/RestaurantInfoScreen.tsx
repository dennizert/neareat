import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Switch,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getMyRestaurantProfile, updateInfo } from '../../services/restaurantAccount';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

export default function RestaurantInfoScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [address, setAddress] = useState('');
  const [reservationUrl, setReservationUrl] = useState('');
  const [acceptsReservations, setAcceptsReservations] = useState(false);

  useEffect(() => {
    getMyRestaurantProfile()
      .then(p => {
        setPhone(p.phone ?? '');
        setContactEmail(p.contactEmail ?? '');
        setAddress(p.address ?? '');
        setReservationUrl(p.reservationUrl ?? '');
        setAcceptsReservations(p.acceptsReservations ?? false);
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
        acceptsReservations,
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

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="large" />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>İletişim Bilgileri</Text>
        <View style={styles.card}>
          <Field label="Telefon Numarası" styles={styles}>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+90 555 000 00 00"
              placeholderTextColor={C.textMuted}
            />
          </Field>
          <Field label="İletişim E-postası" styles={styles}>
            <TextInput
              style={styles.input}
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="isletme@ornek.com"
              placeholderTextColor={C.textMuted}
            />
          </Field>
          <Field label="Adres" last styles={styles}>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              placeholder="Mahalle, sokak, bina..."
              placeholderTextColor={C.textMuted}
            />
          </Field>
        </View>

        <Text style={styles.sectionLabel}>Rezervasyon Sistemi</Text>
        <View style={styles.card}>
          <View style={styles.toggleField}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>NearEat Rezervasyonuna Aç</Text>
              <Text style={styles.toggleHint}>
                Açık olduğunda kullanıcılar uygulama üzerinden rezervasyon talebi gönderebilir.
              </Text>
            </View>
            <Switch
              value={acceptsReservations}
              onValueChange={setAcceptsReservations}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
            />
          </View>
          <Field label="Dış Rezervasyon URL (isteğe bağlı)" last styles={styles}>
            <TextInput
              style={styles.input}
              value={reservationUrl}
              onChangeText={setReservationUrl}
              keyboardType="url"
              autoCapitalize="none"
              placeholder="https://rezervasyon.siteniz.com"
              placeholderTextColor={C.textMuted}
            />
          </Field>
        </View>
        <Text style={styles.hint}>
          NearEat rezervasyonu aktifken kullanıcılar tarih/saat/misafir bilgisiyle talep gönderir, siz onaylar/reddedersiniz.
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

function Field({ label, children, last, styles }: { label: string; children: React.ReactNode; last?: boolean; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={[styles.field, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    body: { padding: 16, paddingBottom: 40 },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: C.textTertiary, marginBottom: 8, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    card: {
      backgroundColor: C.surface, borderRadius: 14, marginBottom: 8,
      shadowColor: C.shadow, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
      overflow: 'hidden',
    },
    field: {
      paddingHorizontal: 14, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: C.separator,
    },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
    input: {
      fontSize: 15, color: C.textPrimary,
      paddingVertical: 0,
    },
    inputMulti: { minHeight: 60, textAlignVertical: 'top' },
    hint: { fontSize: 12, color: C.textMuted, lineHeight: 18, marginBottom: 24 },
    toggleField: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: C.separator, gap: 12,
    },
    toggleLabel: { fontSize: 15, fontWeight: '600', color: C.textPrimary, marginBottom: 2 },
    toggleHint: { fontSize: 12, color: C.textMuted, lineHeight: 16 },
    saveBtn: {
      backgroundColor: C.primary, borderRadius: 14,
      paddingVertical: 16, alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
}
