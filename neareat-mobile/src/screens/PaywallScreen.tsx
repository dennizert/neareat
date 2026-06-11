import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useIAP, getAvailablePurchases } from 'expo-iap';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

// Google Play Console → Monetization → Subscriptions'da tanımlanacak Product ID'ler.
// Rol başına TEK aylık ürün. Bu değerler Play Console'daki Subscription ID'leriyle
// BİREBİR aynı olmalı.
const SKUS = {
  user: 'user_premium',          // 79,90 ₺ / ay
  restaurant: 'restaurant_premium', // 699,90 ₺ / ay
};

// Play Store erişilemiyorsa (ürün henüz oluşturulmadı / emülatör) gösterilecek fiyat.
const FALLBACK_PRICE = {
  user: '79,90 ₺',
  restaurant: '699,90 ₺',
};

type Feature = { icon: string; title: string; desc: string };

const USER_FEATURES: Feature[] = [
  { icon: '♾️', title: 'Limitsiz AI öneri', desc: 'Günlük hak sınırı olmadan dilediğin kadar "ne yesem?" sor' },
  { icon: '🧠', title: 'Daha güçlü AI modeli', desc: 'İnce zevkleri ve niş tercihleri daha iyi yakalayan gelişmiş model' },
  { icon: '👥', title: 'Arkadaş sinyalleri', desc: 'Arkadaşlarının (onay verdiyse) tat tercihleri önerilerine katılır' },
  { icon: '📍', title: 'Geniş keşif alanı', desc: '5 km yerine 25 km çevrendeki restoranları keşfet' },
  { icon: '❤️', title: 'Sınırsız favori & liste', desc: 'İstediğin kadar restoranı favorile, sınırsız liste oluştur' },
  { icon: '📅', title: 'Sınırsız rezervasyon', desc: 'Dilediğin kadar restorana rezervasyon yap' },
];

const RESTAURANT_FEATURES: Feature[] = [
  { icon: '📅', title: 'Rezervasyon kabulü', desc: 'Müşterilerinden uygulama üzerinden online rezervasyon al' },
  { icon: '⚡', title: 'Anlık indirim & kampanya', desc: 'Favori ve geçmiş müşterilerine anlık bildirimli kampanya gönder' },
  { icon: '🍽️', title: 'Ürün fotoğraf galerisi', desc: 'Menü ve ürün fotoğraflarını kullanıcılara göster' },
  { icon: '📈', title: 'Daha fazla görünürlük', desc: 'Öne çıkan içeriklerle daha çok müşteriye ulaş' },
];

export default function PaywallScreen() {
  const navigation = useNavigation<any>();
  const { subscription, setSubscription, isPremium, user } = useAuthStore();
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const isRestaurant = user?.role === 'RESTAURANT';
  const sku = isRestaurant ? SKUS.restaurant : SKUS.user;
  const fallbackPrice = isRestaurant ? FALLBACK_PRICE.restaurant : FALLBACK_PRICE.user;
  const features = isRestaurant ? RESTAURANT_FEATURES : USER_FEATURES;

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
    if (!connected) return;

    requestProducts({ skus: [sku], type: 'subs' }).catch(() => {
      // Play Store erişilemiyor (emülatör / yapılandırılmamış) — fiyat fallback'e düşer
    });

    // Tamamlanmamış satın almaları kurtar: ödendi ama doğrulama tamamlanmadıysa
    // (ağ kopması / crash) backend'e tekrar gönder.
    getAvailablePurchases().then(async (purchases) => {
      for (const purchase of purchases) {
        const token = purchase.purchaseToken;
        if (!token || !purchase.productId) continue;
        try {
          const { data } = await api.post('/subscriptions/verify/android', {
            purchaseToken: token,
            productId: purchase.productId,
          });
          setSubscription(data);
          await finishTransaction({ purchase, isConsumable: false });
          break; // İlk başarılı doğrulamadan sonra dur
        } catch {
          // Bu satın alma doğrulanamadı — bir sonrakini dene
        }
      }
    }).catch(() => {
      // getAvailablePurchases desteklenmiyorsa (emülatör) sessizce geç
    });
  }, [connected, requestProducts, finishTransaction, setSubscription, sku]);

  const product = subscriptions.find((s) => s.id === sku);
  const iapAvailable = !!product;
  const priceText = product?.displayPrice ? product.displayPrice : fallbackPrice;

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

  const startPurchase = useCallback(async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Yakında', 'iOS için App Store entegrasyonu yakında geliyor.');
      return;
    }
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
  }, [product, sku, requestPurchase]);

  // Ana butona basınca: Play hazırsa satın al; değilse deneme (kullanılabilirse)
  function handlePrimary() {
    if (iapAvailable) {
      startPurchase();
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
      ? '✨ Premium\'a Geç'
      : canTrial
        ? '7 Gün Ücretsiz Dene'
        : 'Ödeme yakında aktifleşecek';

  const primaryDisabled = purchasing || (!iapAvailable && !canTrial);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.heroEmoji}>👑</Text>
        <Text style={styles.title}>{isRestaurant ? 'İşletme Premium' : 'Premium'}</Text>
        <Text style={styles.subtitle}>
          {isRestaurant
            ? 'Restoranını öne çıkar — rezervasyon, anlık kampanya, ürün galerisi ve daha fazlası.'
            : 'Eatlas\'tan en iyi şekilde yararlan — sınırsız AI önerisi, daha geniş keşif ve daha fazlası.'}
        </Text>

        {/* Özellikler — başlık + açıklama */}
        <View style={styles.featureList}>
          {features.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Tek aylık plan kartı */}
        <View style={styles.planCard}>
          <View style={styles.planHeaderRow}>
            <Text style={styles.planName}>Aylık Premium</Text>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.planPrice}>{priceText} <Text style={styles.planPriceSuffix}>/ ay</Text></Text>
          <Text style={styles.planSub}>İstediğin zaman iptal edebilirsin</Text>
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

    planCard: {
      borderRadius: 16, borderWidth: 2, borderColor: C.primary,
      backgroundColor: C.primaryLighter, padding: 18, marginBottom: 20,
    },
    planHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    planName: { fontSize: 16, fontWeight: '800', color: C.textPrimary },
    checkMark: { fontSize: 14, fontWeight: '900', color: C.primary },
    planPrice: { fontSize: 24, color: C.textPrimary, marginTop: 6, fontWeight: '800' },
    planPriceSuffix: { fontSize: 14, color: C.textSecondary, fontWeight: '600' },
    planSub: { fontSize: 12, color: C.textTertiary, marginTop: 4 },

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
