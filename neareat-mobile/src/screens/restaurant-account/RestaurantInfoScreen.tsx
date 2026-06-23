import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Switch,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  getMyRestaurantProfile, updateInfo,
  getPhotoUploadUrl, uploadPhotoToS3, addRestaurantPhoto,
  listRestaurantPhotos, deleteRestaurantPhoto, PhotoStorageUnavailableError,
} from '../../services/restaurantAccount';
import type { RestaurantPhoto, RestaurantPhotoKind } from '../../types';
import { handleRestaurantPremiumError } from '../../utils/premiumGate';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

const MAX_PHOTOS = 8;
const TARGET_WIDTH = 1280; // S3 maliyeti + hız için yeniden boyutlandırma

export default function RestaurantInfoScreen() {
  const navigation = useNavigation<any>();
  const toast = useToast();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [address, setAddress] = useState('');
  const [reservationUrl, setReservationUrl] = useState('');
  const [acceptsReservations, setAcceptsReservations] = useState(false);
  const [tableCount, setTableCount] = useState('');
  const [seatCapacity, setSeatCapacity] = useState(''); // S19-5: koltuk kapasitesi (doluluk)

  const [restaurantPhotos, setRestaurantPhotos] = useState<RestaurantPhoto[]>([]);
  const [productPhotos, setProductPhotos] = useState<RestaurantPhoto[]>([]);

  useEffect(() => {
    Promise.all([
      getMyRestaurantProfile(),
      listRestaurantPhotos().catch(() => [] as RestaurantPhoto[]),
    ])
      .then(([p, photos]) => {
        setDisplayName(p.displayName ?? '');
        setPhone(p.phone ?? '');
        setAltPhone(p.altPhone ?? '');
        setContactEmail(p.contactEmail ?? '');
        setAddress(p.address ?? '');
        setReservationUrl(p.reservationUrl ?? '');
        setAcceptsReservations(p.acceptsReservations ?? false);
        setTableCount(p.tableCount != null ? String(p.tableCount) : '');
        setSeatCapacity(p.seatCapacity != null ? String(p.seatCapacity) : '');
        setRestaurantPhotos(photos.filter(x => x.kind === 'RESTAURANT'));
        setProductPhotos(photos.filter(x => x.kind === 'PRODUCT'));
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
    const dn = displayName.trim();
    if (dn && (dn.length < 2 || dn.length > 80)) {
      Alert.alert('Hata', 'Görünen ad 2-80 karakter arasında olmalıdır.');
      return;
    }

    setSaving(true);
    try {
      const tc = tableCount.trim();
      if (tc && (isNaN(Number(tc)) || Number(tc) < 1 || Number(tc) > 500)) {
        Alert.alert('Hata', 'Masa kapasitesi 1-500 arasında olmalıdır.');
        return;
      }
      const sc = seatCapacity.trim();
      if (sc && (isNaN(Number(sc)) || Number(sc) < 1 || Number(sc) > 5000)) {
        Alert.alert('Hata', 'Koltuk kapasitesi 1-5000 arasında olmalıdır.');
        return;
      }
      await updateInfo({
        displayName: dn || '',
        phone: phone.trim(),
        altPhone: altPhone.trim() || '',
        contactEmail: contactEmail.trim(),
        address: address.trim(),
        reservationUrl: reservationUrl.trim() || undefined,
        acceptsReservations,
        tableCount: tc ? Number(tc) : null,
        seatCapacity: sc ? Number(sc) : null,
      });
      toast.show('Restoran bilgilerin güncellendi', 'success');
      navigation.goBack();
    } catch (err: any) {
      if (handleRestaurantPremiumError(err, { trigger: 'reservations', message: 'Rezervasyon kabul etmek Premium üyelik gerektirir.' })) return;
      Alert.alert('Hata', err.userMessage ?? err.response?.data?.error ?? 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="large" />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.body, { paddingBottom: bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>Restoran Bilgileri</Text>
        <View style={styles.card}>
          <Field label="Görünen Ad (isteğe bağlı)" styles={styles}>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Kullanıcılara gösterilecek ad"
              placeholderTextColor={C.textMuted}
              maxLength={80}
            />
          </Field>
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
          <Field label="Alternatif Telefon (isteğe bağlı)" styles={styles}>
            <TextInput
              style={styles.input}
              value={altPhone}
              onChangeText={setAltPhone}
              keyboardType="phone-pad"
              placeholder="+90 555 111 11 11"
              placeholderTextColor={C.textMuted}
              maxLength={20}
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
        <Text style={styles.hint}>
          Görünen ad girdiğinizde kullanıcılar Google adı yerine bu adı görür. Boş bırakırsanız Google adı kullanılır.
        </Text>

        <PhotoGallerySection
          title="Restoran Fotoğrafları"
          hint="Mekanınızın iç/dış fotoğrafları. Kullanıcı kartında ve detayda önce bunlar gösterilir."
          kind="RESTAURANT"
          photos={restaurantPhotos}
          setPhotos={setRestaurantPhotos}
          styles={styles}
          C={C}
        />

        <PhotoGallerySection
          title="Ürün Fotoğrafları"
          hint="Yemek ve ürün fotoğraflarınız. Restoran detayında ayrı bir bölümde gösterilir."
          kind="PRODUCT"
          photos={productPhotos}
          setPhotos={setProductPhotos}
          styles={styles}
          C={C}
        />

        <Text style={styles.sectionLabel}>Rezervasyon Sistemi</Text>
        <View style={styles.card}>
          <View style={styles.toggleField}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Eatlas Rezervasyonuna Aç</Text>
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
          <Field label="Dış Rezervasyon URL (isteğe bağlı)" styles={styles}>
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
          <Field label="Masa Kapasitesi (isteğe bağlı)" styles={styles}>
            <TextInput
              style={styles.input}
              value={tableCount}
              onChangeText={setTableCount}
              keyboardType="number-pad"
              placeholder="Aynı saate max rezervasyon (boş = sınırsız)"
              placeholderTextColor={C.textMuted}
              maxLength={3}
            />
          </Field>
          <Field label="Koltuk Kapasitesi (isteğe bağlı)" last styles={styles}>
            <TextInput
              style={styles.input}
              value={seatCapacity}
              onChangeText={setSeatCapacity}
              keyboardType="number-pad"
              placeholder="Toplam sandalye sayısı (doluluk için)"
              placeholderTextColor={C.textMuted}
              maxLength={4}
            />
          </Field>
        </View>
        <Text style={styles.hint}>
          Eatlas rezervasyonu aktifken kullanıcılar tarih/saat/misafir bilgisiyle talep gönderir, siz onaylar/reddedersiniz.
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

/** Tek bir foto galerisi bölümü — seç → S3'e yükle → kaydet → grid; sil. */
function PhotoGallerySection({
  title, hint, kind, photos, setPhotos, styles, C,
}: {
  title: string;
  hint: string;
  kind: RestaurantPhotoKind;
  photos: RestaurantPhoto[];
  setPhotos: React.Dispatch<React.SetStateAction<RestaurantPhoto[]>>;
  styles: ReturnType<typeof makeStyles>;
  C: Colors;
}) {
  const [uploading, setUploading] = useState(false);
  const atLimit = photos.length >= MAX_PHOTOS;

  async function handleAdd() {
    if (atLimit) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    setUploading(true);
    try {
      // İstemci tarafı yeniden boyutlandırma + sıkıştırma → JPEG
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: TARGET_WIDTH } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const contentType = 'image/jpeg';

      const { uploadUrl, publicUrl } = await getPhotoUploadUrl(kind, contentType);
      await uploadPhotoToS3(uploadUrl, manipulated.uri, contentType);
      const saved = await addRestaurantPhoto(kind, publicUrl);
      setPhotos(prev => [...prev, saved]);
    } catch (err: any) {
      if (err instanceof PhotoStorageUnavailableError) {
        Alert.alert('Fotoğraf Yükleme', err.message);
      } else if (handleRestaurantPremiumError(err, { trigger: 'product_photos', message: 'Ürün fotoğrafı yüklemek Premium üyelik gerektirir.' })) {
        // premium popup gösterildi
      } else {
        Alert.alert('Hata', err.userMessage ?? err.response?.data?.error ?? 'Fotoğraf yüklenemedi. Lütfen tekrar deneyin.');
      }
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(photo: RestaurantPhoto) {
    Alert.alert('Fotoğrafı Sil', 'Bu fotoğraf galeriden kaldırılsın mı?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: async () => {
          try {
            await deleteRestaurantPhoto(photo.id);
            setPhotos(prev => prev.filter(p => p.id !== photo.id));
          } catch {
            Alert.alert('Hata', 'Silinemedi.');
          }
        },
      },
    ]);
  }

  return (
    <>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.card}>
        <View style={styles.galleryBody}>
          <Text style={styles.galleryHint}>{hint}</Text>
          <View style={styles.galleryGrid}>
            {photos.map(photo => (
              <View key={photo.id} style={styles.photoItem}>
                <Image source={{ uri: photo.url }} style={styles.photoImg} resizeMode="cover" />
                <TouchableOpacity style={styles.photoDelete} onPress={() => handleDelete(photo)}>
                  <Text style={styles.photoDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {!atLimit && (
              <TouchableOpacity
                style={[styles.photoItem, styles.addTile, uploading && { opacity: 0.6 }]}
                onPress={handleAdd}
                disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator color={C.primary} />
                  : <Text style={styles.addTileText}>＋</Text>}
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.galleryCount}>{photos.length}/{MAX_PHOTOS} fotoğraf</Text>
        </View>
      </View>
    </>
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
    // Galeri
    galleryBody: { padding: 14 },
    galleryHint: { fontSize: 12, color: C.textMuted, lineHeight: 18, marginBottom: 12 },
    galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    photoItem: {
      width: '30%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden',
      backgroundColor: C.inputBg,
    },
    photoImg: { width: '100%', height: '100%' },
    photoDelete: {
      position: 'absolute', top: 4, right: 4,
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
    },
    photoDeleteText: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
    addTile: {
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.border,
    },
    addTileText: { fontSize: 30, color: C.primary, fontWeight: '300' },
    galleryCount: { fontSize: 11, color: C.textMuted, marginTop: 10, textAlign: 'right' },
  });
}
