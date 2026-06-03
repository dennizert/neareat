import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useIAP } from 'expo-iap';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

// Google Play Console → Monetization → Subscriptions'da tanımlanacak Product ID'ler.
// Bu değerler Play Console'daki Subscription ID'leriyle BİREBİR aynı olmalı.
const SKUS = {
  monthly: 'premium_monthly',
  yearly: 'premium_yearly',
};

// Açıklayıcı özellik listesi — her biri başlık + tek satır açıklama
const FEATURES: { icon: string; title: string; desc: string }[] = [
  { icon: '♾️', title: 'Limitsiz AI öneri', desc: 'Günlük 3 hak sınırı olmadan dilediğin kadar "ne yesem?" sor' },
  { icon: '🧠', title: 'Daha güçlü AI modeli', desc: 'İnce zevkleri ve niş tercihleri daha iyi yakalayan gelişmiş model' },
  { icon: '👥', title: 'Arkadaş sinyalleri', desc: 'Arkadaşlarının (onay verdiyse) tat tercihleri önerilerine katılır' },
  { icon: '📍', title: 'Geniş keşif alanı', desc: '5 km yerine 25 km çevrendeki restoranları keşfet' },
  { icon: '❤️', title: 'Sınırsız favori', desc: 'İstediğin kadar restoranı favorilerine kaydet' },
  { icon: '🏆', title: '2x Yıldız', desc: 'Her aksiyonda iki kat yıldız — ödüllere daha hızlı ulaş' },
];

export default function PaywallScreen() {
  const navigation = useNavigation<any>();
  const { subscription, setSubscription, isPremium } = useAuthStore();
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [selected, setSelected] = useState<'yearly' | 'monthly'>('yearly');
  const [purchasing, setPurchasing] = useState(false);

  // Deneme daha önce kullanıldıysa (herhangi bir abonelik kaydı varsa) backend yeni
  // trial'ı reddeder → "7 gün ücretsiz dene" butonunu gizle.
  const alreadyPremium = isPremium();
  const hasUsedTrial = !!subscription;
  const canTrial = !hasUsedTrial && !alreadyPremium;

  const { connected, subscriptions, requestProducts, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      const token = purchase.purchaseToken;
      if (!token) {
        setPurchasing(false);
        return;
      }
      try {
        const { data } = await api.post('/subscriptions/verify/android', {
          purchaseToken: token,
          productId: purchase.productId,
        });
        setSubscription(data);
        await finishTransaction({ purchase, isConsumable: false });
        navigation.goBack();
        Alert.alert('Premium Aktif 🎉', 'Aboneliğin başarıyla etkinleştirildi!');
      } catch (err: any) {
        Alert.alert('Hata', err.userMessage || err.response?.data?.error || 'Abonelik doğrulanamadı.');
      } finally {
        setPurchasing(false);
      }
    },
    onPurchaseError: (error) => {
      setPurchasing(false);
      if (error?.code !== 'E_USER_CANCELLED') {
        Alert.alert('Satın Alma Hatası', error?.message || 'Bilinmeyen bir hata oluştu.');
      }
    },
  });

  useEffect(() => {
    if (connected) {
      requestProducts({ skus: Object.values(SKUS), type: 'subs' }).catch(() => {
        // Play Store erişilemiyor (emülatör / yapılandırılmamış) — fiyatlar "—" kalır
      });
    }
  }, [connected, requestProducts]);

  const iapAvailable = subscriptions.length > 0;

  const getProduct = useCallback(
    (plan: 'monthly' | 'yearly') => subscriptions.find((s) => s.id === SKUS[plan]),
    [subscriptions],
  );

  function priceLabel(plan: 'monthly' | 'yearly') {
    const p = getProduct(plan);
    const suffix = plan === 'yearly' ? '/ yıl' : '/ ay';
    if (!p?.displayPrice) return `—  ${suffix}`;
    return `${p.displayPrice} ${suffix}`;
  }

  // Yıllık planın aylık eşdeğeri (fiyat sayısal olarak geldiyse)
  function yearlyMonthlyEquivalent(): string | null {
    const p: any = getProduct('yearly');
    if (!p || typeof p.price !== 'number' || !p.price) return null;
    const perMonth = p.price / 12;
    const cur = p.currency || '';
    return `≈ ${perMonth.toFixed(0)} ${cur}/ay`;
  }

  async function handleTrial() {
    try {
      setPurchasing(true);
      const { data } = await api.post('/subscriptions/trial');
      setSubscription(data);
      navigation.goBack();
      Alert.alert('Deneme Başladı 🎉', '7 günlük Premium denemen aktif!');
    } catch (err: any) {
      Alert.alert('Hata', err.userMessage || err.response?.data?.error || 'Deneme başlatılamadı.');
    } finally {
      setPurchasing(false);
    }
  }

  async function startPurchase(plan: 'monthly' | 'yearly') {
    if (Platform.OS !== 'android') {
      Alert.alert('Yakında', 'iOS için App Store entegrasyonu yakında geliyor.');
      return;
    }
    const sku = SKUS[plan];
    const product = getProduct(plan);
    if (!product) {
      Alert.alert('Yakında', 'Ödeme sistemi yakında aktifleşecek. Şimdilik ücretsiz denemeyi kullanabilirsin.');
      return;
    }
    const offers = ((product as any).subscriptionOfferDetails ?? []).map(
      (o: { offerToken: string }) => ({ sku, offerToken: o.offerToken }),
    );
    try {
      setPurchasing(true);
      await requestPurchase({
        type: 'subs',
        request: {
          android: { skus: [sku], subscriptionOffers: offers },
          ios: { sku },
        },
      });
    } catch {
      setPurchasing(false);
    }
  }

  // Ana butona basınca: Play hazırsa satın al; değilse deneme (kullanılabilirse)
  function handlePrimary() {
    if (iapAvailable) {
      startPurchase(selected);
    } else if (canTrial) {
      handleTrial();
    }
  }

  // ── Zaten premium ise sade bir bilgi ekranı ──
  if (alreadyPremium) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.centered}>
          <Text style={styles.premiumEmoji}>👑</Text>
          <Text style={styles.title}>Zaten Premium'sun</Text>
          <Text style={styles.subtitle}>Tüm premium özelliklere erişimin açık. Teşekkürler!</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>Harika!</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const primaryLabel = purchasing
    ? null
    : iapAvailable
      ? `✨ ${selected === 'yearly' ? 'Yıllık' : 'Aylık'} Premium'a Geç`
      : canTrial
        ? '7 Gün Ücretsiz Dene'
        : 'Ödeme yakında aktifleşecek';

  const primaryDisabled = purchasing || (!iapAvailable && !canTrial);
  const monthlyEq = yearlyMonthlyEquivalent();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.heroEmoji}>👑</Text>
        <Text style={styles.title}>Premium</Text>
        <Text style={styles.subtitle}>
          Eatlas'tan en iyi şekilde yararlan — sınırsız AI önerisi, daha geniş keşif ve daha fazlası.
        </Text>

        {/* Özellikler — başlık + açıklama */}
        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Plan seçimi */}
        <Text style={styles.sectionLabel}>Planını seç</Text>
        <View style={styles.planRow}>
          {/* Yıllık */}
          <TouchableOpacity
            style={[styles.planCard, selected === 'yearly' && styles.planCardActive]}
            onPress={() => setSelected('yearly')}
            activeOpacity={0.85}
          >
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>En Popüler · %35 tasarruf</Text>
            </View>
            <View style={styles.planHeaderRow}>
              <Text style={styles.planName}>Yıllık</Text>
              {selected === 'yearly' && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.planPrice}>{priceLabel('yearly')}</Text>
            {monthlyEq && <Text style={styles.planSub}>{monthlyEq}</Text>}
          </TouchableOpacity>

          {/* Aylık */}
          <TouchableOpacity
            style={[styles.planCard, selected === 'monthly' && styles.planCardActive]}
            onPress={() => setSelected('monthly')}
            activeOpacity={0.85}
          >
            <View style={styles.planHeaderRow}>
              <Text style={styles.planName}>Aylık</Text>
              {selected === 'monthly' && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.planPrice}>{priceLabel('monthly')}</Text>
            <Text style={styles.planSub}>Esnek, aylık yenilenir</Text>
          </TouchableOpacity>
        </View>

        {/* Ana CTA */}
        <TouchableOpacity
          style={[styles.primaryBtn, primaryDisabled && styles.primaryBtnDisabled]}
          onPress={handlePrimary}
          disabled={primaryDisabled}
          activeOpacity={0.85}
        >
          {purchasing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>{primaryLabel}</Text>}
        </TouchableOpacity>

        {/* Play hazır + deneme hakkı varsa ikincil deneme seçeneği */}
        {iapAvailable && canTrial && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleTrial} disabled={purchasing}>
            <Text style={styles.secondaryBtnText}>veya önce 7 gün ücretsiz dene</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.legal}>
          {iapAvailable
            ? 'Abonelik Google Play üzerinden yönetilir; istediğin zaman iptal edebilirsin. Devam ederek Kullanım Şartları ve Gizlilik Politikasını kabul etmiş olursun.'
            : 'Devam ederek Kullanım Şartları ve Gizlilik Politikasını kabul etmiş olursun.'}
        </Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.surface },
    scroll: { padding: 24, paddingBottom: 40 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    closeBtn: { position: 'absolute', top: 48, right: 24, zIndex: 10 },
    closeBtnText: { fontSize: 20, color: C.textMuted },

    heroEmoji: { fontSize: 44, textAlign: 'center', marginBottom: 8 },
    premiumEmoji: { fontSize: 56, marginBottom: 16 },
    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 14, color: C.textTertiary, textAlign: 'center', lineHeight: 21, marginBottom: 24, paddingHorizontal: 8 },

    featureList: { marginBottom: 24 },
    featureRow: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
    featureIcon: { fontSize: 22, width: 30, textAlign: 'center' },
    featureBody: { flex: 1 },
    featureTitle: { fontSize: 15, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
    featureDesc: { fontSize: 13, color: C.textTertiary, lineHeight: 18 },

    sectionLabel: { fontSize: 13, fontWeight: '700', color: C.textSecondary, marginBottom: 10 },
    planRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    planCard: {
      flex: 1, borderRadius: 16, borderWidth: 2,
      borderColor: C.border, padding: 16, paddingTop: 18, minHeight: 110, justifyContent: 'flex-end',
    },
    planCardActive: { borderColor: C.primary, backgroundColor: C.primaryLighter },
    popularBadge: {
      position: 'absolute', top: -10, left: 12, right: 12,
      backgroundColor: C.primary, borderRadius: 8,
      paddingHorizontal: 6, paddingVertical: 3, alignItems: 'center',
    },
    popularText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    planHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    planName: { fontSize: 16, fontWeight: '800', color: C.textPrimary },
    checkMark: { fontSize: 14, fontWeight: '900', color: C.primary },
    planPrice: { fontSize: 14, color: C.textSecondary, marginTop: 4, fontWeight: '600' },
    planSub: { fontSize: 11, color: C.success, marginTop: 2 },

    primaryBtn: {
      backgroundColor: C.primary, borderRadius: 14,
      paddingVertical: 16, alignItems: 'center', marginBottom: 8,
      minHeight: 52, justifyContent: 'center',
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    secondaryBtn: { paddingVertical: 10, alignItems: 'center', marginBottom: 8 },
    secondaryBtnText: { color: C.textTertiary, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
    legal: { fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 16, marginTop: 8 },
  });
}
