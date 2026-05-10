import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, Modal, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useUserProfileStore } from '../../store/userProfileStore';
import { updateMyProfile } from '../../services/social';
import { COUNTRIES, type Country } from '../../data/countriesAndCities';

const CUISINE_OPTIONS = [
  'Türk Mutfağı', 'İtalyan', 'Japon', 'Fransız', 'Deniz Ürünleri',
  'Kahvaltı', 'Fast Food', 'Vejeteryan', 'Vegan', 'Füzyon',
];

function findCountryForCity(cityName: string): Country | undefined {
  return COUNTRIES.find(c => c.cities.includes(cityName));
}

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const { profile, updateProfile } = useUserProfileStore();

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl ?? '');
  const [selectedCountry, setSelectedCountry] = useState<Country | undefined>(
    () => findCountryForCity(profile?.city ?? ''),
  );
  const [city, setCity] = useState(profile?.city ?? '');
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(
    profile?.favoriteCuisines ?? [],
  );
  const [isPublic, setIsPublic] = useState(profile?.isPublic ?? true);
  const [saving, setSaving] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [pickingPhoto, setPickingPhoto] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setBio(profile.bio);
      setPhotoUrl(profile.photoUrl ?? '');
      setCity(profile.city);
      setSelectedCuisines(profile.favoriteCuisines);
      setIsPublic(profile.isPublic);
      setSelectedCountry(findCountryForCity(profile.city));
    }
  }, [profile?.id]);

  async function handlePickPhoto() {
    setPickingPhoto(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri erişimine izin verin.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      if (!result.canceled && result.assets[0].base64) {
        setPhotoUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch {
      Alert.alert('Hata', 'Fotoğraf seçilemedi.');
    } finally {
      setPickingPhoto(false);
    }
  }

  function toggleCuisine(cuisine: string) {
    setSelectedCuisines(prev =>
      prev.includes(cuisine) ? prev.filter(c => c !== cuisine) : [...prev, cuisine],
    );
  }

  async function handleSave() {
    if (!displayName.trim()) {
      Alert.alert('Hata', 'İsim boş olamaz.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMyProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        city: city.trim(),
        favoriteCuisines: selectedCuisines,
        isPublic,
        photoUrl: photoUrl || undefined,
      });
      updateProfile(updated);
      navigation.goBack();
    } catch {
      Alert.alert('Hata', 'Profil güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
    : COUNTRIES;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

      {/* Profil Fotoğrafı */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickPhoto} disabled={pickingPhoto} style={styles.avatarWrapper}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            {pickingPhoto
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.avatarBadgeText}>✏️</Text>
            }
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Fotoğrafı değiştirmek için tıklayın</Text>
      </View>

      {/* Ad Soyad */}
      <View style={styles.section}>
        <Text style={styles.label}>Ad Soyad</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Adınızı girin"
          placeholderTextColor="#9CA3AF"
          maxLength={50}
        />
      </View>

      {/* Biyografi */}
      <View style={styles.section}>
        <Text style={styles.label}>Biyografi</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={bio}
          onChangeText={setBio}
          placeholder="Kendinizden bahsedin..."
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
          maxLength={200}
        />
        <Text style={styles.charCount}>{bio.length}/200</Text>
      </View>

      {/* Ülke Seçimi */}
      <View style={styles.section}>
        <Text style={styles.label}>Ülke</Text>
        <TouchableOpacity style={styles.picker} onPress={() => setShowCountryModal(true)}>
          <Text style={[styles.pickerText, !selectedCountry && styles.pickerPlaceholder]}>
            {selectedCountry ? selectedCountry.name : 'Ülke seçin...'}
          </Text>
          <Text style={styles.pickerArrow}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Şehir Seçimi */}
      <View style={styles.section}>
        <Text style={styles.label}>Şehir</Text>
        <TouchableOpacity
          style={[styles.picker, !selectedCountry && styles.pickerDisabled]}
          onPress={() => selectedCountry && setShowCityModal(true)}
        >
          <Text style={[styles.pickerText, !city && styles.pickerPlaceholder]}>
            {city || (selectedCountry ? 'Şehir seçin...' : 'Önce ülke seçin')}
          </Text>
          <Text style={styles.pickerArrow}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Favori Mutfaklar */}
      <View style={styles.section}>
        <Text style={styles.label}>Favori Mutfaklar</Text>
        <View style={styles.chipGrid}>
          {CUISINE_OPTIONS.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, selectedCuisines.includes(c) && styles.chipActive]}
              onPress={() => toggleCuisine(c)}
            >
              <Text style={[styles.chipText, selectedCuisines.includes(c) && styles.chipTextActive]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Gizlilik */}
      <View style={styles.section}>
        <Text style={styles.label}>Gizlilik</Text>
        <TouchableOpacity
          style={[styles.toggleRow, isPublic && styles.toggleRowActive]}
          onPress={() => setIsPublic(v => !v)}
        >
          <View>
            <Text style={styles.toggleTitle}>{isPublic ? '🌍 Herkese Açık' : '🔒 Gizli Profil'}</Text>
            <Text style={styles.toggleSub}>
              {isPublic
                ? 'Önerileriniz ve profiliniz herkes tarafından görülebilir.'
                : 'Profiliniz yalnızca arkadaşlarınız tarafından görülebilir.'}
            </Text>
          </View>
          <View style={[styles.toggle, isPublic && styles.toggleOn]}>
            <View style={[styles.toggleThumb, isPublic && styles.toggleThumbOn]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Kaydet Butonu */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      {/* Ülke Seçim Modalı */}
      <Modal visible={showCountryModal} transparent animationType="slide" onRequestClose={() => setShowCountryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ülke Seçin</Text>
              <TouchableOpacity onPress={() => { setShowCountryModal(false); setCountrySearch(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Ülke ara..."
              placeholderTextColor="#9CA3AF"
              value={countrySearch}
              onChangeText={setCountrySearch}
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={item => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, selectedCountry?.code === item.code && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setCity('');
                    setShowCountryModal(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={[styles.modalItemText, selectedCountry?.code === item.code && styles.modalItemTextActive]}>
                    {item.name}
                  </Text>
                  {selectedCountry?.code === item.code && <Text style={styles.modalCheck}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Şehir Seçim Modalı */}
      <Modal visible={showCityModal} transparent animationType="slide" onRequestClose={() => setShowCityModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedCountry?.name} — Şehir Seçin</Text>
              <TouchableOpacity onPress={() => setShowCityModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={selectedCountry?.cities ?? []}
              keyExtractor={item => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, city === item && styles.modalItemActive]}
                  onPress={() => {
                    setCity(item);
                    setShowCityModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, city === item && styles.modalItemTextActive]}>
                    {item}
                  </Text>
                  {city === item && <Text style={styles.modalCheck}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  avatarSection: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#fff', marginBottom: 10 },
  avatarWrapper: { position: 'relative', marginBottom: 10 },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: '#FF6B35' },
  avatarPlaceholder: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  avatarEmoji: { fontSize: 40 },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FF6B35', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarBadgeText: { fontSize: 12 },
  avatarHint: { fontSize: 12, color: '#9CA3AF' },

  section: { backgroundColor: '#fff', padding: 16, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },

  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#FAFAFA',
  },
  pickerDisabled: { opacity: 0.5 },
  pickerText: { fontSize: 15, color: '#111827', flex: 1 },
  pickerPlaceholder: { color: '#9CA3AF' },
  pickerArrow: { fontSize: 14, color: '#9CA3AF', marginLeft: 8 },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#F9FAFB',
  },
  chipActive: { borderColor: '#FF6B35', backgroundColor: '#FFF0EB' },
  chipText: { fontSize: 13, color: '#6B7280' },
  chipTextActive: { color: '#FF6B35', fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  toggleRowActive: { borderColor: '#FF6B35', backgroundColor: '#FFF7F4' },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  toggleSub: { fontSize: 12, color: '#6B7280', maxWidth: 250 },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB', justifyContent: 'center', padding: 2 },
  toggleOn: { backgroundColor: '#FF6B35' },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },

  saveBtn: {
    backgroundColor: '#FF6B35', margin: 16, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '75%', paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1, marginRight: 12 },
  modalClose: { fontSize: 18, color: '#6B7280', padding: 4 },
  searchInput: {
    margin: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  modalItemActive: { backgroundColor: '#FFF4F0' },
  modalItemText: { fontSize: 15, color: '#374151' },
  modalItemTextActive: { color: '#FF6B35', fontWeight: '600' },
  modalCheck: { fontSize: 16, color: '#FF6B35' },
});
