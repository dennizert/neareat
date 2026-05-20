import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getRestaurantDetail, approveRestaurant, rejectRestaurant, getTaxCertificate } from '../../services/admin';
import type { AdminRestaurantSummary } from '../../types';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

export default function AdminRestaurantDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { restaurantId } = route.params as { restaurantId: string };
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [restaurant, setRestaurant] = useState<(AdminRestaurantSummary & { hasTaxCertificate: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [taxCertData, setTaxCertData] = useState<string | null>(null);
  const [loadingCert, setLoadingCert] = useState(false);
  const [certModalVisible, setCertModalVisible] = useState(false);

  useEffect(() => {
    getRestaurantDetail(restaurantId).then(setRestaurant).catch(() => {
      Alert.alert('Hata', 'Yüklenemedi.');
      navigation.goBack();
    }).finally(() => setLoading(false));
  }, [restaurantId]);

  async function handleApprove() {
    Alert.alert('Onayla', `${restaurant?.businessName} onaylanacak. Emin misiniz?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Onayla', onPress: async () => {
          setProcessing(true);
          try {
            const updated = await approveRestaurant(restaurantId);
            setRestaurant(prev => prev ? { ...prev, ...updated } : prev);
            Alert.alert('Onaylandı!', 'Restoran hesabı aktif edildi.');
          } catch (err: any) {
            Alert.alert('Hata', err.response?.data?.error ?? 'İşlem başarısız.');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  }

  async function handleReject() {
    if (!rejectionReason.trim()) {
      Alert.alert('Hata', 'Red nedeni zorunludur.');
      return;
    }
    setProcessing(true);
    try {
      const updated = await rejectRestaurant(restaurantId, rejectionReason.trim());
      setRestaurant(prev => prev ? { ...prev, ...updated } : prev);
      setRejectModalVisible(false);
      Alert.alert('Reddedildi', 'Restoran başvurusu reddedildi.');
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error ?? 'İşlem başarısız.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleViewCert() {
    if (taxCertData) { setCertModalVisible(true); return; }
    setLoadingCert(true);
    try {
      const result = await getTaxCertificate(restaurantId);
      setTaxCertData(result.data);
      setCertModalVisible(true);
    } catch { Alert.alert('Hata', 'Vergi levhası yüklenemedi.'); }
    finally { setLoadingCert(false); }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={C.primary} size="large" />;
  if (!restaurant) return null;

  const statusColor: Record<string, string> = { PENDING: C.warning, APPROVED: '#22C55E', REJECTED: C.error };
  const statusLabel: Record<string, string> = { PENDING: 'Bekliyor', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi' };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.body}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusColor[restaurant.status] + '22' }]}>
          <Text style={[styles.statusBannerText, { color: statusColor[restaurant.status] }]}>
            {statusLabel[restaurant.status]}
          </Text>
          {restaurant.status === 'APPROVED' && restaurant.approvedAt && (
            <Text style={[styles.statusDate, { color: statusColor[restaurant.status] }]}>
              {new Date(restaurant.approvedAt).toLocaleDateString('tr-TR')}
            </Text>
          )}
        </View>

        {restaurant.rejectionReason && (
          <View style={styles.rejectionBox}>
            <Text style={styles.rejectionLabel}>Red Nedeni</Text>
            <Text style={styles.rejectionText}>{restaurant.rejectionReason}</Text>
          </View>
        )}

        {/* Business info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İşletme Bilgileri</Text>
          <InfoRowComponent label="İşletme Adı" value={restaurant.businessName} styles={styles} />
          <InfoRowComponent label="Yetkili" value={restaurant.ownerName} styles={styles} />
          <InfoRowComponent label="Kategori" value={restaurant.businessCategory} styles={styles} />
          <InfoRowComponent label="Telefon" value={restaurant.phone} styles={styles} />
          <InfoRowComponent label="E-posta" value={restaurant.contactEmail} styles={styles} />
          <InfoRowComponent label="Adres" value={restaurant.address} styles={styles} />
          <InfoRowComponent label="Vergi No" value={restaurant.taxNumber} styles={styles} />
          <InfoRowComponent label="Vergi Dairesi" value={restaurant.taxOffice} styles={styles} />
          <InfoRowComponent label="Hesap E-posta" value={restaurant.user.email} styles={styles} />
          <InfoRowComponent label="Başvuru" value={new Date(restaurant.createdAt).toLocaleDateString('tr-TR')} styles={styles} />
        </View>

        {/* Tax certificate */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vergi Levhası</Text>
          {restaurant.hasTaxCertificate ? (
            <TouchableOpacity style={styles.certBtn} onPress={handleViewCert} disabled={loadingCert}>
              {loadingCert
                ? <ActivityIndicator color="#4F46E5" size="small" />
                : <Text style={styles.certBtnText}>📄 Vergi Levhasını Görüntüle</Text>}
            </TouchableOpacity>
          ) : (
            <Text style={styles.noCert}>Vergi levhası yüklenmemiş.</Text>
          )}
        </View>

        {/* Selected restaurant */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seçilen Restoran (Google Places)</Text>
          {restaurant.placeId ? (
            <>
              {restaurant.placePhotoUrl && (
                <Image source={{ uri: restaurant.placePhotoUrl }} style={styles.placePhoto} />
              )}
              <InfoRowComponent label="Restoran Adı" value={restaurant.placeName ?? '—'} styles={styles} />
              <InfoRowComponent label="Adres" value={restaurant.placeAddress ?? '—'} styles={styles} />
              <InfoRowComponent label="Place ID" value={restaurant.placeId} styles={styles} />
            </>
          ) : (
            <Text style={styles.noCert}>Restoran seçimi yapılmamış.</Text>
          )}
        </View>
      </ScrollView>

      {/* Actions */}
      {restaurant.status === 'PENDING' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.rejectBtn, processing && { opacity: 0.5 }]}
            onPress={() => setRejectModalVisible(true)}
            disabled={processing}
          >
            <Text style={styles.rejectBtnText}>❌ Reddet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.approveBtn, processing && { opacity: 0.5 }]}
            onPress={handleApprove}
            disabled={processing}
          >
            {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveBtnText}>✅ Onayla</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Reject Modal */}
      <Modal visible={rejectModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
              <Text style={styles.modalClose}>İptal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Red Nedeni</Text>
            <TouchableOpacity onPress={handleReject} disabled={processing}>
              {processing ? <ActivityIndicator color={C.error} size="small" /> : <Text style={styles.modalConfirm}>Reddet</Text>}
            </TouchableOpacity>
          </View>
          <Text style={styles.modalHint}>Restoran sahibine gösterilecek red nedenini girin:</Text>
          <TextInput
            style={styles.reasonInput}
            value={rejectionReason}
            onChangeText={setRejectionReason}
            placeholder="Örn: Vergi numarası bilgileri tutarsız, lütfen tekrar başvurun."
            placeholderTextColor={C.textMuted}
            multiline numberOfLines={5}
            autoFocus
          />
        </View>
      </Modal>

      {/* Tax cert modal */}
      <Modal visible={certModalVisible} animationType="fade" onRequestClose={() => setCertModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 56, right: 16, zIndex: 10 }} onPress={() => setCertModalVisible(false)}>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '300' }}>✕</Text>
          </TouchableOpacity>
          {taxCertData && (
            <Image source={{ uri: taxCertData }} style={{ width: '95%', height: '80%' }} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

function InfoRowComponent({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable>{value}</Text>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    body: { padding: 16, paddingBottom: 32 },
    statusBanner: { borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusBannerText: { fontSize: 15, fontWeight: '800' },
    statusDate: { fontSize: 12 },
    rejectionBox: { backgroundColor: C.errorSurface, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
    rejectionLabel: { fontSize: 12, fontWeight: '700', color: '#DC2626', marginBottom: 4 },
    rejectionText: { fontSize: 13, color: '#7F1D1D', lineHeight: 18 },
    section: { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: C.shadow, shadowOpacity: 0.04, elevation: 1 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: C.textSecondary, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.separator },
    infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.background, justifyContent: 'space-between' },
    infoLabel: { fontSize: 12, color: C.textMuted, fontWeight: '600', width: 110 },
    infoValue: { fontSize: 13, color: C.textPrimary, flex: 1, textAlign: 'right' },
    certBtn: { backgroundColor: '#EEF2FF', borderRadius: 10, padding: 12, alignItems: 'center' },
    certBtnText: { color: '#4F46E5', fontWeight: '700', fontSize: 14 },
    noCert: { fontSize: 13, color: C.textMuted, fontStyle: 'italic' },
    placePhoto: { width: '100%', height: 140, borderRadius: 10, marginBottom: 10 },
    actions: { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.separator },
    rejectBtn: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    rejectBtnText: { color: C.error, fontWeight: '700', fontSize: 15 },
    approveBtn: { flex: 1, backgroundColor: '#22C55E', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    modalContainer: { flex: 1, backgroundColor: C.surface, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.separator },
    modalClose: { fontSize: 16, color: C.textTertiary },
    modalTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary },
    modalConfirm: { fontSize: 16, color: C.error, fontWeight: '700' },
    modalHint: { fontSize: 13, color: C.textTertiary, marginBottom: 12, lineHeight: 18 },
    reasonInput: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 15, color: C.textPrimary, minHeight: 120, textAlignVertical: 'top', backgroundColor: C.inputBg },
  });
}
