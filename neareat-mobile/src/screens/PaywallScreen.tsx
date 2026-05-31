import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
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

const FEATURES = [
  '♾️  Limitsiz AI öneri — günlük 3 limit yok',
  '🧠  Daha güçlü model — daha ince zevkleri yakalar',
  '👥  Arkadaş sinyalleri — opt-in tercih paylaşımı',
  '📍  25 km mesafede restoran keşfi (5 km\'den fazla)',
  '❤️  Sınırsız favori kaydet',
  '🏆  2x Yıldız — ödüllere daha hızlı ulaş',
];

export default function PaywallScreen() {
  const navigation = useNavigation<any>();
  const { setSubscription } = useAuthStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [selected, setSelected] = useState<'yearly' | 'monthly'>('yearly');
  const [purchasing, setPurchasing] = useState(false);

  // expo-iap hook — bağlantı, ürünler ve satın alma callback'lerini yönetir.
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
        // Aboneliği tamamla (consume etme — abonelik tek seferlik tüketilmez)
        await finishTransaction({ purchase, isConsumable: false });
        navigation.goBack();
        Alert.alert('Premium Aktif', 'Aboneliğin başarıyla etkinleştirildi!');
      } catch (err: any) {
        Alert.alert('Hata', err.response?.data?.error || 'Abonelik doğrulanamadı.');
      } finally {
        setPurchasing(false);
      }
    },
    onPurchaseError: (error) => {
      setPurchasing(false);
      // Kullanıcı satın almayı iptal ettiyse sessiz geç; gerçek hatalarda uyar
      if (error?.code !== 'E_USER_CANCELLED') {
        Alert.alert('Satın Alma Hatası', error?.message || 'Bilinmeyen bir hata oluştu.');
      }
    },
  });

  // Bağlantı kurulunca ürünleri getir
  useEffect(() => {
    if (connected) {
      requestProducts({ skus: Object.values(SKUS), type: 'subs' }).catch(() => {
        // Play Store erişilemiyor (emülatör / yapılandırılmamış) — trial fallback devreye girer
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
    if (!p?.displayPrice) return `— TRY ${suffix}`;
    return `${p.displayPrice} ${suffix}`;
  }

  async function handleTrial() {
    try {
      setPurchasing(true);
      const { data } = await api.post('/subscriptions/trial');
      setSubscription(data);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Deneme başlatılamadı.');
    } finally {
      setPurchasing(false);
    }
  }

  async function handlePurchase() {
    if (Platform.OS !== 'android') {
      Alert.alert('Yakında', 'iOS için App Store entegrasyonu yakında geliyor.');
      return;
    }
    const sku = SKUS[selected];
    const product = getProduct(selected);
    // Play Console henüz yapılandırılmadıysa veya ürün yüklenemediyse trial'a düş
    if (!product) {
      handleTrial();
      return;
    }
    // Google Play aboneliklerinde offerToken zorunlu — ürünün offer detaylarından çıkar
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
      // Sonuç onPurchaseSuccess / onPurchaseError callback'lerinde işlenir
    } catch {
      setPurchasing(false);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Premium</Text>
      <Text style={styles.subtitle}>Tüm özelliklere erişin</Text>

      <View style={styles.featureList}>
        {FEATURES.map((f) => (
          <Text key={f} style={styles.featureItem}>{f}</Text>
        ))}
      </View>

      <View style={styles.planRow}>
        {/* Yıllık */}
        <TouchableOpacity
          style={[styles.planCard, selected === 'yearly' && styles.planCardActive]}
          onPress={() => setSelected('yearly')}
        >
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>En Popüler</Text>
          </View>
          <Text style={styles.planName}>Yıllık</Text>
          <Text style={styles.planPrice}>{priceLabel('yearly')}</Text>
          <Text style={styles.planSavings}>%35 tasarruf</Text>
        </TouchableOpacity>

        {/* Aylık */}
        <TouchableOpacity
          style={[styles.planCard, selected === 'monthly' && styles.planCardActive]}
          onPress={() => setSelected('monthly')}
        >
          <Text style={styles.planName}>Aylık</Text>
          <Text style={styles.planPrice}>{priceLabel('monthly')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, purchasing && styles.primaryBtnDisabled]}
        onPress={handlePurchase}
        disabled={purchasing}
        activeOpacity={0.85}
      >
        {purchasing
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.primaryBtnText}>
              {iapAvailable
                ? `✨ ${selected === 'yearly' ? 'Yıllık' : 'Aylık'} Premium'a Geç`
                : '7 Gün Ücretsiz Dene'}
            </Text>
        }
      </TouchableOpacity>

      <Text style={styles.legal}>
        {iapAvailable
          ? 'Abonelik Google Play üzerinden yönetilir. İstediğin zaman iptal edebilirsin.'
          : 'Devam ederek Kullanım Şartları ve Gizlilik Politikasını kabul etmiş olursunuz.'}
      </Text>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.surface, padding: 24, paddingTop: 48 },
    closeBtn: { position: 'absolute', top: 48, right: 24, zIndex: 10 },
    closeBtnText: { fontSize: 20, color: C.textMuted },
    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, textAlign: 'center', marginBottom: 4 },
    subtitle: { fontSize: 15, color: C.textTertiary, textAlign: 'center', marginBottom: 24 },
    featureList: { marginBottom: 24 },
    featureItem: { fontSize: 15, color: C.textSecondary, marginBottom: 10, lineHeight: 22 },
    planRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    planCard: {
      flex: 1, borderRadius: 14, borderWidth: 2,
      borderColor: C.border, padding: 16, alignItems: 'center',
    },
    planCardActive: { borderColor: C.primary, backgroundColor: C.primaryLighter },
    popularBadge: {
      backgroundColor: C.primary, borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6,
    },
    popularText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    planName: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    planPrice: { fontSize: 13, color: C.textTertiary, marginTop: 2 },
    planSavings: { fontSize: 11, color: C.success, marginTop: 2 },
    primaryBtn: {
      backgroundColor: C.primary, borderRadius: 14,
      paddingVertical: 16, alignItems: 'center', marginBottom: 12,
      minHeight: 52, justifyContent: 'center',
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    legal: { fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 16 },
  });
}
