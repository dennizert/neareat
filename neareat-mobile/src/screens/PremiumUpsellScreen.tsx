/**
 * PremiumUpsellScreen — AI öneri özelinde paywall (Sprint-1 Task #10).
 *
 * Mevcut `PaywallScreen` genel premium pitch; bu ekran AI özelliğine
 * odaklı: "Bugünkü 3 hakkını kullandın, kalan süre X, premium'a geçersen
 * limit yok + daha güçlü model."
 *
 * Akış:
 *   - RecommendationScreen 429 LIMIT_EXCEEDED → useEffect ile bu ekrana auto-navigate
 *   - Kullanıcı isterse "Premium Detayları" → mevcut Paywall'a (Iyzico checkout vs)
 *   - "Bugün için kapat" → geri (kalan sürede yapacak başka bir şey yok)
 *
 * Reset countdown: `resetAt` ISO param'ından her 60sn güncelleniyor.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

type PremiumUpsellRouteProp = RouteProp<RootStackParamList, 'PremiumUpsell'>;

const FEATURES = [
  {
    icon: '♾️',
    title: 'Limitsiz Öneri',
    desc: 'Günlük 3 limit yok — istediğin kadar "Şimdi ne yesem?" sor',
  },
  {
    icon: '🧠',
    title: 'Daha Güçlü Model',
    desc: 'Premium\'da Sonnet 4.6 — daha ince zevkleri ve niş tercihleri daha iyi yakalar',
  },
  {
    icon: '👥',
    title: 'Arkadaş Sinyalleri',
    desc: 'Arkadaşlarının opt-in verdiği tat tercihleri önerilerine dahil olur',
  },
  {
    icon: '⚡',
    title: 'Öncelikli Hız',
    desc: 'Yoğun saatlerde de hızlı yanıt — premium kuyruğu',
  },
];

export default function PremiumUpsellScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<PremiumUpsellRouteProp>();
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  const resetAt = route.params?.resetAt;
  const countdown = useResetCountdown(resetAt);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero icon */}
        <View style={styles.heroIcon}>
          <Text style={styles.heroEmoji}>⏰</Text>
        </View>

        {/* Headline */}
        <Text style={styles.title}>Günlük AI öneri hakkın doldu</Text>
        <Text style={styles.subtitle}>
          Ücretsiz tier'da günde 3 AI öneri hakkın var.{'\n'}
          Yarın yenilenmesini bekleyebilir veya Premium'a geçebilirsin.
        </Text>

        {/* Reset countdown card */}
        {countdown && (
          <View style={styles.countdownCard}>
            <Text style={styles.countdownLabel}>Yenileme Zamanı</Text>
            <Text style={styles.countdownTime}>{countdown}</Text>
            <Text style={styles.countdownHint}>
              Türkiye saati gece yarısı sıfırlanır
            </Text>
          </View>
        )}

        {/* Premium features */}
        <View style={styles.featureSection}>
          <Text style={styles.sectionTitle}>Premium ile neler değişiyor?</Text>
          {FEATURES.map((f, i) => (
            <View key={f.title} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTAs */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.replace('Paywall', { trigger: 'popular_times' })}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>✨ Premium Detaylarını Gör</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryBtnText}>Bugün için kapat</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Premium iptali istediğin zaman. KVKK uyumlu — arkadaş verisi sadece
          onay verirsen kullanılır.
        </Text>
      </ScrollView>
    </View>
  );
}

/**
 * resetAt ISO'dan kalan süreyi "Xs Ys" veya "X dakika" formatında döner.
 * Her 60sn güncellenir. Geçtiyse "Şimdi yenileniyor..." döner.
 */
function useResetCountdown(resetAt?: string): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!resetAt) return null;
  try {
    const target = new Date(resetAt).getTime();
    if (isNaN(target)) return null;
    const diff = target - now;
    if (diff <= 0) return 'Şimdi yenileniyor…';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    if (hours === 0) return `${minutes} dakika`;
    if (minutes === 0) return `${hours} saat`;
    return `${hours} saat ${minutes} dakika`;
  } catch {
    return null;
  }
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    scroll: { padding: 20, paddingTop: 24, paddingBottom: 40 },

    heroIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: C.primarySurface,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 16,
    },
    heroEmoji: { fontSize: 40 },

    title: {
      fontSize: 24,
      fontWeight: '800',
      color: C.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: C.textTertiary,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 24,
    },

    countdownCard: {
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    countdownLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: C.textTertiary,
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    countdownTime: {
      fontSize: 28,
      fontWeight: '800',
      color: C.primary,
      marginBottom: 4,
    },
    countdownHint: {
      fontSize: 12,
      color: C.textMuted,
    },

    featureSection: { marginBottom: 28 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: C.textPrimary,
      marginBottom: 14,
    },
    featureRow: {
      flexDirection: 'row',
      gap: 14,
      marginBottom: 14,
      paddingHorizontal: 4,
    },
    featureIcon: { fontSize: 28, width: 36, textAlign: 'center' },
    featureBody: { flex: 1 },
    featureTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: C.textPrimary,
      marginBottom: 2,
    },
    featureDesc: {
      fontSize: 13,
      color: C.textTertiary,
      lineHeight: 18,
    },

    primaryBtn: {
      backgroundColor: C.primary,
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
      marginBottom: 10,
      shadowColor: C.primary,
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    primaryBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },

    secondaryBtn: {
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 16,
    },
    secondaryBtnText: {
      color: C.textTertiary,
      fontSize: 14,
      fontWeight: '600',
    },

    footerNote: {
      fontSize: 11,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 16,
      paddingHorizontal: 12,
    },
  });
}
