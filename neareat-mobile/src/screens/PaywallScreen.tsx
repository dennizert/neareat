import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  type Subscription as IAPSubscription,
  type PurchaseError,
} from 'react-native-iap';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

// Google Play Console → Monetization → Subscriptions'da tanımlayacağın Product ID'ler.
// Faz 4'te bu değerleri Play Console'daki Product ID'lerle eşleştir.
const ANDROID_SKUS = {
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
  const [products, setProducts] = useState<IAPSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [iapAvailable, setIapAvailable] = useState(false);

  // IAP başlat + ürünleri getir
  useEffect(() => {
    let mounted = true;

    async function setup() {
      try {
        if (Platform.OS !== 'android') {
          setLoading(false);
          return;
        }
        await initConnection();
        const subs = await getSubscriptions({ skus: Object.values(ANDROID_SKUS) });
        if (mounted) {
          setProducts(subs);
          setIapAvailable(subs.length > 0);
        }
      } catch {
        // Play Store bağlantısı kurulamadı — emülatörde veya test ortamında olabilir
      } finally {
        if (mounted) setLoading(false);
      }
    }
    setup();

    // Satın alma tamamlandığında tetiklenir
    const purchaseListener = purchaseUpdatedListener(async (purchase) => {
      if (!purchase?.purchaseToken) return;
      try {
        const { data } = await api.post('/subscriptions/verify/android', {
          purchaseToken: purchase.purchaseToken,
          productId: purchase.productId,
        });
        setSubscription(data);
        await finishTransaction({ purchase, isConsumable: false });
        navigation.goBack();
        Alert.alert('Premium Aktif', 'Aboneliğin başarıyla etkinleştirildi!');
      } catch (err: any) {
        Alert.alert('Hata', err.response?.data?.error || 'Abonelik doğrulanamadı.');
      } finally {
        setPurchasing(false);
      }
    });

    const errorListener = purchaseErrorListener((error: PurchaseError) => {
      setPurchasing(false);
      if (error.code !== 'E_USER_CANCELLED') {
        Alert.alert('Satın Alma Hatası', error.message || 'Bilinmeyen bir hata oluştu.');
      }
    });

    return () => {
      mounted = false;
      purchaseListener.remove();
      errorListener.remove();
      endConnection();
    };
  }, []);

  const getProduct = useCallback(
    (plan: 'monthly' | 'yearly') =>
      products.find((p) => p.productId === ANDROID_SKUS[plan]),
    [products],
  );

  async function handlePurchase() {
    const sku = ANDROID_SKUS[selected];
    if (Platform.OS !== 'android') {
      Alert.alert('Yakında', 'iOS için App Store entegrasyonu yakında geliyor.');
      return;
    }
    if (!iapAvailable) {
      // Play Console henüz yapılandırılmadıysa trial'a yönlendir
      handleTrial();
      return;
    }
    try {
      setPurchasing(true);
      await requestSubscription({ sku });
      // Gerisi purchaseUpdatedListener'da tamamlanır
    } catch {
      setPurchasing(false);
    }
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

  const monthlyProduct = getProduct('monthly');
  const yearlyProduct = getProduct('yearly');

  function priceLabel(plan: 'monthly' | 'yearly') {
    const p = getProduct(plan);
    if (!p) return plan === 'yearly' ? '— TRY / yıl' : '— TRY / ay';
    return plan === 'yearly'
      ? `${p.localizedPrice} / yıl`
      : `${p.localizedPrice} / ay`;
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

      {loading ? (
        <ActivityIndicator color={C.primary} style={{ marginVertical: 24 }} />
      ) : (
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
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, purchasing && styles.primaryBtnDisabled]}
        onPress={handlePurchase}
        disabled={purchasing || loading}
        activeOpacity={0.85}
      >
        {purchasing
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.primaryBtnText}>
              {iapAvailable ? `✨ ${selected === 'yearly' ? 'Yıllık' : 'Aylık'} Premium'a Geç` : '7 Gün Ücretsiz Dene'}
            </Text>
        }
      </TouchableOpacity>

      <Text style={styles.legal}>
        {iapAvailable
          ? 'Abonelik Google Play üzerinden yönetilir. İstediğin zaman iptal edebilirsin.'
          : 'Devam ederek Kullanım Şartları ve Gizlilik Politikasını kabul etmiş olursunuz.'
        }
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
