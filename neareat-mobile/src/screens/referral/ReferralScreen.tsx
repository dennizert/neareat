import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Share, Alert, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import { getMyReferralCode, applyReferralCode, type ReferralCodeInfo } from '../../services/referral';

export default function ReferralScreen() {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();

  const [info, setInfo] = useState<ReferralCodeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    getMyReferralCode()
      .then(setInfo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleShare() {
    if (!info) return;
    try {
      await Share.share({
        message: `NearEat'i dene! Kaydolurken "${info.code}" referans kodumu gir, ikimiz de yıldız kazanırız 🍽️ https://neareat.app`,
        title: 'NearEat\'e Davet',
      });
    } catch {
      // kullanıcı iptal etti
    }
  }

  async function handleApply() {
    const code = applyCode.trim().toUpperCase();
    if (!code) return;
    setApplying(true);
    try {
      const result = await applyReferralCode(code);
      setApplied(true);
      Alert.alert(
        '🎉 Davet Kodu Uygulandı!',
        `${result.referrerName}'in davet koduyla ${result.earnedStars} yıldız kazandın!`,
      );
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Kod uygulanamadı.';
      Alert.alert('Hata', msg);
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottom + 16 }]} keyboardShouldPersistTaps="handled">

        {/* Kodunu Paylaş */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Davet Kodun</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{info?.code ?? '—'}</Text>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color="#fff" />
              <Text style={styles.shareBtnText}>Paylaş</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cardHint}>
            Arkadaşın bu kodu kaydolurken girerse ikisini de 15 yıldız kazanırsınız.
          </Text>
        </View>

        {/* İstatistikler */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{info?.usageCount ?? 0}</Text>
            <Text style={styles.statLabel}>Davet edilen kişi</Text>
          </View>
          <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: C.border }]}>
            <Text style={styles.statValue}>⭐ {info?.earnedStars ?? 0}</Text>
            <Text style={styles.statLabel}>Kazanılan yıldız</Text>
          </View>
        </View>

        {/* Kod Uygula */}
        {!applied ? (
          <View style={styles.applySection}>
            <Text style={styles.applyTitle}>Referans Kodu Var mı?</Text>
            <Text style={styles.applyHint}>
              Seni davet eden arkadaşının kodunu gir, 10 yıldız kazan.
            </Text>
            <View style={styles.applyRow}>
              <TextInput
                style={styles.codeInput}
                placeholder="örn: AHME5678"
                placeholderTextColor={C.textMuted}
                value={applyCode}
                onChangeText={(t) => setApplyCode(t.toUpperCase())}
                maxLength={10}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.applyBtn, (!applyCode.trim() || applying) && styles.applyBtnDisabled]}
                onPress={handleApply}
                disabled={!applyCode.trim() || applying}
              >
                {applying
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.applyBtnText}>Uygula</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.appliedBox}>
            <Ionicons name="checkmark-circle" size={28} color={C.success} />
            <Text style={styles.appliedText}>Davet kodu uygulandı!</Text>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },
    scroll: { padding: 16, paddingBottom: 40 },

    card: {
      backgroundColor: C.surface, borderRadius: 16, padding: 20,
      borderWidth: 1, borderColor: C.border, marginBottom: 12,
    },
    cardLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
    codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    codeText: { fontSize: 32, fontWeight: '800', color: C.primary, letterSpacing: 4 },
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    },
    shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    cardHint: { fontSize: 13, color: C.textMuted, lineHeight: 18 },

    statsRow: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
    statBox: { flex: 1, alignItems: 'center', paddingVertical: 18 },
    statValue: { fontSize: 22, fontWeight: '800', color: C.textPrimary, marginBottom: 4 },
    statLabel: { fontSize: 12, color: C.textMuted, textAlign: 'center' },

    applySection: {
      backgroundColor: C.surface, borderRadius: 14, padding: 18,
      borderWidth: 1, borderColor: C.border,
    },
    applyTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, marginBottom: 6 },
    applyHint: { fontSize: 13, color: C.textMuted, marginBottom: 14, lineHeight: 18 },
    applyRow: { flexDirection: 'row', gap: 10 },
    codeInput: {
      flex: 1, backgroundColor: C.background, borderWidth: 1, borderColor: C.border,
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
      fontSize: 16, fontWeight: '700', color: C.primary, letterSpacing: 2,
    },
    applyBtn: {
      backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 11,
      borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    },
    applyBtnDisabled: { opacity: 0.5 },
    applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    appliedBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18, backgroundColor: C.successSurface, borderRadius: 14 },
    appliedText: { fontSize: 15, fontWeight: '700', color: C.success },
  });
}
