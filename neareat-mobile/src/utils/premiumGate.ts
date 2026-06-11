import { Alert } from 'react-native';

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

/**
 * Regular kullanıcı akışı: premium hatasıysa Paywall'a yönlendirir.
 * @returns hata ele alındıysa true (çağıran ayrıca Alert göstermemeli).
 */
export function handleUserPremiumError(
  err: any,
  navigation: { navigate: (screen: string, params?: any) => void },
  trigger: PaywallTrigger,
): boolean {
  if (!isPremiumRequired(err)) return false;
  navigation.navigate('Paywall', { trigger });
  return true;
}

/**
 * Restoran kullanıcı akışı: Paywall ekranı restoran stack'inde kayıtlı olmadığından
 * bilgilendirici bir popup gösterir (gerçek restoran satın-alma akışı ayrı sprintte).
 * @returns hata ele alındıysa true.
 */
export function handleRestaurantPremiumError(err: any, fallbackMessage?: string): boolean {
  if (!isPremiumRequired(err)) return false;
  Alert.alert(
    'Premium Gerekli',
    err?.response?.data?.error || fallbackMessage || 'Bu özellik Premium üyelik gerektirir.',
    [{ text: 'Tamam' }],
  );
  return true;
}
