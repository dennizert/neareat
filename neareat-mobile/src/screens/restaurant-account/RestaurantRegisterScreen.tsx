import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { registerRestaurant } from '../../services/restaurantAccount';
import { fetchNearby } from '../../services/restaurants';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import type { Restaurant } from '../../types';

const CATEGORIES = ['Restoran', 'Kafe', 'Fast Food', 'Pastane/Fırın', 'Esnaf Lokantası', 'Diğer'];
const STEPS = ['Hesap Bilgileri', 'İşletme Bilgileri', 'Vergi Levhası', 'Restoran Seç', 'Onay'];

export default function RestaurantRegisterScreen() {
  const navigation = useNavigation<any>();
  const { setUser, setToken, setRestaurantStatus } = useAuthStore();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0 — Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ownerName, setOwnerName] = useState('');

  // Step 1 — Business
  const [businessName, setBusinessName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [taxOffice, setTaxOffice] = useState('');
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [address, setAddress] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');

  // Step 2 — Tax certificate
  const [taxCertBase64, setTaxCertBase64] = useState<string | null>(null);
  const [taxCertUri, setTaxCertUri] = useState<string | null>(null);

  // Step 3 — Place
  const [nearbyPlaces, setNearbyPlaces] = useState<Restaurant[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Restaurant | null>(null);

  function validateStep() {
    if (step === 0) {
      if (!email.trim() || !password || !ownerName.trim()) return 'Tüm alanları doldurun.';
      if (password.length < 8) return 'Şifre en az 8 karakter olmalı.';
      if (!email.includes('@')) return 'Geçerli bir e-posta girin.';
    }
    if (step === 1) {
      if (!businessName.trim() || !taxNumber || !taxOffice.trim() || !phone.trim() || !contactEmail.trim() || !address.trim() || !businessCategory) {
        return 'Tüm alanları doldurun.';
      }
      if (!/^\d{10}$/.test(taxNumber)) return 'Vergi numarası 10 haneli olmalı.';
    }
    return null;
  }

  async function handleNext() {
    const err = validateStep();
    if (err) { Alert.alert('Hata', err); return; }

    if (step === 2) {
      setStep(3);
      loadNearbyPlaces();
      return;
    }
    if (step < 4) { setStep(s => s + 1); return; }
    await handleSubmit();
  }

  async function loadNearbyPlaces() {
    setLoadingPlaces(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('İzin gerekli', 'Konum izni olmadan yakın restoranlar listelenemez.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const result = await fetchNearby(loc.coords.latitude, loc.coords.longitude, 'all');
      setNearbyPlaces(result.results.slice(0, 30));
    } catch {
      Alert.alert('Hata', 'Yakın restoranlar yüklenemedi.');
    } finally {
      setLoadingPlaces(false);
    }
  }

  async function pickTaxCertificate() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setTaxCertUri(result.assets[0].uri);
      setTaxCertBase64(result.assets[0].base64 ? `data:image/jpeg;base64,${result.assets[0].base64}` : null);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const result = await registerRestaurant({
        email: email.toLowerCase().trim(),
        password,
        ownerName: ownerName.trim(),
        businessName: businessName.trim(),
        taxNumber,
        taxOffice: taxOffice.trim(),
        phone: phone.trim(),
        contactEmail: contactEmail.trim(),
        address: address.trim(),
        businessCategory,
        placeId: selectedPlace?.placeId,
        placeName: selectedPlace?.name,
        placeAddress: selectedPlace?.formattedAddress ?? undefined,
        placePhotoUrl: selectedPlace?.photoUrl ?? undefined,
        taxCertificateData: taxCertBase64 ?? undefined,
      });
      await SecureStore.setItemAsync('neareat_auth_token', result.token);
      setToken(result.token);
      setRestaurantStatus({ status: result.restaurantProfile.status, rejectionReason: result.restaurantProfile.rejectionReason });
      setUser({ ...result.user, googleId: null, photoUrl: null, fcmToken: null, authProvider: 'email', isSuspended: false } as any);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'Kayıt başarısız.');
    } finally {
      setLoading(false);
    }
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <View>
            <Text style={styles.stepTitle}>Hesap Bilgileri</Text>
            <TextInput style={styles.input} placeholder="Adınız Soyadınız" value={ownerName} onChangeText={setOwnerName} placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.input} placeholder="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.input} placeholder="Şifre (en az 8 karakter)" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#9CA3AF" />
          </View>
        );
      case 1:
        return (
          <View>
            <Text style={styles.stepTitle}>İşletme Bilgileri</Text>
            <TextInput style={styles.input} placeholder="İşletme Adı" value={businessName} onChangeText={setBusinessName} placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.input} placeholder="Vergi Numarası (10 hane)" value={taxNumber} onChangeText={setTaxNumber} keyboardType="number-pad" maxLength={10} placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.input} placeholder="Vergi Dairesi" value={taxOffice} onChangeText={setTaxOffice} placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.input} placeholder="Telefon Numarası" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.input} placeholder="İletişim E-postası" value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9CA3AF" />
            <TextInput style={[styles.input, styles.inputMulti]} placeholder="İşletme Adresi" value={address} onChangeText={setAddress} multiline numberOfLines={2} placeholderTextColor="#9CA3AF" />
            <Text style={styles.fieldLabel}>İşletme Kategorisi</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, businessCategory === cat && styles.categoryChipActive]}
                  onPress={() => setBusinessCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, businessCategory === cat && styles.categoryChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.certStep}>
            <Text style={styles.stepTitle}>Vergi Levhası</Text>
            <Text style={styles.stepSubtitle}>Vergi levhanızın fotoğrafını yükleyin. Onay sürecinde kullanılacak.</Text>
            <TouchableOpacity style={styles.certUploadBtn} onPress={pickTaxCertificate}>
              {taxCertUri ? (
                <Image source={{ uri: taxCertUri }} style={styles.certPreview} resizeMode="contain" />
              ) : (
                <>
                  <Text style={styles.certUploadIcon}>📄</Text>
                  <Text style={styles.certUploadText}>Fotoğraf Seç</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.certNote}>Vergi levhası yüklemeden de devam edebilirsiniz.</Text>
          </View>
        );
      case 3:
        return (
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>Restoranınızı Seçin</Text>
            <Text style={styles.stepSubtitle}>Yakınındaki restoranlardan işletmenizi seçin. Bulamazsanız devam edin.</Text>
            {loadingPlaces ? (
              <ActivityIndicator color="#FF6B35" style={{ marginTop: 20 }} />
            ) : (
              nearbyPlaces.map(place => (
                <TouchableOpacity
                  key={place.placeId}
                  style={[styles.placeRow, selectedPlace?.placeId === place.placeId && styles.placeRowSelected]}
                  onPress={() => setSelectedPlace(p => p?.placeId === place.placeId ? null : place)}
                >
                  {place.photoUrl ? (
                    <Image source={{ uri: place.photoUrl }} style={styles.placePhoto} />
                  ) : (
                    <View style={[styles.placePhoto, { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 20 }}>🍽️</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, paddingLeft: 10 }}>
                    <Text style={styles.placeName}>{place.name}</Text>
                    <Text style={styles.placeAddr} numberOfLines={1}>{(place as any).formattedAddress ?? `${place.distanceKm.toFixed(1)} km`}</Text>
                  </View>
                  {selectedPlace?.placeId === place.placeId && <Text style={{ color: '#22C55E', fontWeight: '700', fontSize: 18 }}>✓</Text>}
                </TouchableOpacity>
              ))
            )}
          </View>
        );
      case 4:
        return (
          <View>
            <Text style={styles.stepTitle}>Başvuruyu Gönder</Text>
            <View style={styles.summaryCard}>
              <SummaryRow label="İşletme" value={businessName} />
              <SummaryRow label="Yetkili" value={ownerName} />
              <SummaryRow label="Vergi No" value={taxNumber} />
              <SummaryRow label="Kategori" value={businessCategory} />
              <SummaryRow label="Telefon" value={phone} />
              <SummaryRow label="Seçilen Restoran" value={selectedPlace?.name ?? 'Seçilmedi'} />
              <SummaryRow label="Vergi Levhası" value={taxCertBase64 ? '✓ Yüklendi' : '✗ Yüklenmedi'} />
            </View>
            <Text style={styles.disclaimer}>
              Başvurunuz yönetim ekibimiz tarafından incelenecek. Onay sonrası restoran panelinize erişebilirsiniz.
            </Text>
          </View>
        );
      default:
        return null;
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : navigation.goBack()}>
            <Text style={styles.backBtn}>‹ Geri</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>İşletme Kaydı</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Step indicators */}
        <View style={styles.stepBar}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.stepDot, i <= step && styles.stepDotActive]} />
          ))}
        </View>
        <Text style={styles.stepLabel}>{step + 1}/{STEPS.length} — {STEPS[step]}</Text>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {renderStep()}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextBtn, loading && { opacity: 0.6 }]}
            onPress={handleNext}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.nextBtnText}>{step === 4 ? 'Başvuruyu Gönder' : 'Devam Et'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { fontSize: 17, color: '#FF6B35', fontWeight: '600', width: 60 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  stepBar: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: '#fff' },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  stepDotActive: { backgroundColor: '#FF6B35' },
  stepLabel: { textAlign: 'center', fontSize: 12, color: '#6B7280', marginBottom: 8 },
  body: { padding: 20, paddingBottom: 40 },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  stepTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  stepSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    color: '#111827', backgroundColor: '#fff', marginBottom: 12,
  },
  inputMulti: { height: 70, textAlignVertical: 'top' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  categoryChipActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  categoryChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff' },
  certStep: { alignItems: 'center', paddingTop: 8 },
  certUploadBtn: {
    width: 200, height: 200, borderRadius: 16, borderWidth: 2, borderColor: '#E5E7EB',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F9FAFB', overflow: 'hidden',
  },
  certPreview: { width: 200, height: 200 },
  certUploadIcon: { fontSize: 40, marginBottom: 8 },
  certUploadText: { fontSize: 15, color: '#6B7280', fontWeight: '600' },
  certNote: { marginTop: 12, fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  placeRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, marginBottom: 8, padding: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  placeRowSelected: { borderColor: '#22C55E', backgroundColor: '#F0FDF4' },
  placePhoto: { width: 52, height: 52, borderRadius: 8 },
  placeName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  placeAddr: { fontSize: 12, color: '#9CA3AF' },
  summaryCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  summaryLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  summaryValue: { fontSize: 13, color: '#111827', fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  disclaimer: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
  nextBtn: {
    backgroundColor: '#FF6B35', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
