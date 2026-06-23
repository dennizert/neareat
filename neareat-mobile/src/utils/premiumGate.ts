import { Alert } from 'react-native';
import { navigate } from '../navigation/navigationRef';

// Paywall ekranının kabul ettiği tetikleyici bağlamlar. Backend free-tier limiti
// dolduğunda (403 PREMIUM_REQUIRED) hangi bağlamdan gelindiğini Paywall'a iletir.
export type PaywallTrigger =
  | 'favorites'
  | 'reviews'
  | 'popular_times'
  | 'onboarding'
  | 'collections'
  | 'reservations'
  | 'recommendations'
  | 'product_photos';

/**
 * Backend'den gelen hatanın "premium gerekli" olup olmadığını anlar.
 * Limit dolduğunda controller'lar 403 { code: 'PREMIUM_REQUIRED' } döner.
 */
export function isPremiumRequired(err: any): boolean {
  const code = err?.response?.data?.code ?? err?.code;
  return code === 'PREMIUM_REQUIRED';
}

// NOT (S18-5): Kullanıcı (USER) premium'u kaldırıldı; USER tarafı artık Paywall'a
// yönlendirilmez — seviye-bazlı erişim için `utils/levelGate.ts` kullanılır.
// `handleUserPremiumError` bu nedenle KALDIRILDI. Restoran tarafı premium akışı korunur
// (Sprint-19'da elden geçecek).

/**
 * Restoran kullanıcı akışı: bilgilendirici bir popup gösterir ve "Premium'a Geç"
 * ile role-aware Paywall ekranına (restaurant_premium) yönlendirir. Restoran
 * ekranları navigation prop'u taşımayabildiğinden global navigationRef kullanılır.
 * @returns hata ele alındıysa true.
 */
export function handleRestaurantPremiumError(
  err: any,
  opts?: { trigger?: PaywallTrigger; message?: string },
): boolean {
  if (!isPremiumRequired(err)) return false;
  Alert.alert(
    'Premium Gerekli',
    err?.response?.data?.error || opts?.message || 'Bu özellik Premium üyelik gerektirir.',
    [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Premium\'a Geç', onPress: () => navigate('Paywall', { trigger: opts?.trigger ?? 'reservations' }) },
    ],
  );
  return true;
}
