/**
 * Kimlik Doğrulama Servisi
 *
 * Uygulamanın tüm auth işlemlerini yönetir:
 * - Google Sign-In ile giriş
 * - Email/password ile kayıt ve giriş
 * - JWT token'ların güvenli depolanması (SecureStore)
 * - Oturum geri yükleme (app restart sonrası)
 * - Çıkış yapma
 *
 * MOCK_MODE aktifken gerçek backend çağrısı yapılmaz — UI geliştirme hızlanır.
 */
import * as SecureStore from 'expo-secure-store';
import { MOCK_MODE } from '../config';
import { MOCK_USER } from '../mocks/data';
import type { User, Subscription, RestaurantProfile } from '../types';
import api, { setTokenGetter } from './api';

// Google Sign-In modülü sadece gerçek modda yüklenir — mock modda native modül gerektirmez
let GoogleSignin: any = null;
if (!MOCK_MODE) {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
}

/**
 * SecureStore anahtarı — JWT token bu anahtar ile saklanır.
 * SecureStore, AsyncStorage'dan farklı olarak Android Keystore / iOS Keychain
 * kullanır, yani token şifreli olarak depolanır.
 */
const TOKEN_KEY = 'neareat_auth_token';

/**
 * SecureStore'dan kaydedilmiş JWT token'ı okur.
 * Uygulama yeniden başlatıldığında oturumu geri yüklemek için kullanılır.
 *
 * @returns Kaydedilmiş token veya null
 */
export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/**
 * JWT token'ı SecureStore'a kaydeder ve API interceptor'ına token getter'ı ayarlar.
 * Email/password auth sonrasında çağrılır.
 *
 * @param token - Backend'den dönen JWT token
 */
async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  setTokenGetter(getStoredToken);
}

/**
 * Kaydedilmiş token'ı siler ve token getter'ı temizler.
 * Çıkış yapıldığında veya geçersiz oturum tespit edildiğinde çağrılır.
 */
export async function clearStoredToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  setTokenGetter(null as any);
}

/**
 * Google Sign-In SDK'sını yapılandırır.
 * webClientId, Firebase Console'dan alınan OAuth 2.0 client ID'sidir.
 * Mock modda çağrı atlanır — native modül gerektirmez.
 *
 * @param webClientId - Firebase OAuth 2.0 Web Client ID
 */
export function configureGoogleSignIn(webClientId: string) {
  if (MOCK_MODE || !GoogleSignin) return;
  GoogleSignin.configure({ webClientId });
}

/**
 * Google ile oturum açar.
 * İşlem sırası: Play Services kontrolü → Google Sign-In → idToken alma →
 * Backend'e idToken gönderme → Kullanıcı ve abonelik bilgisi döndürme.
 *
 * Neden bu fonksiyon yazıldı:
 * Google Auth, NearEat'in birincil giriş yöntemidir. Firebase ID token'ı
 * backend'e gönderilir, backend kullanıcıyı oluşturur/bulur ve döner.
 *
 * @returns Kullanıcı bilgisi ve varsa abonelik durumu
 */
export async function signInWithGoogle(): Promise<{ user: User; subscription: Subscription | null }> {
  if (MOCK_MODE) return { user: MOCK_USER, subscription: null };

  await GoogleSignin.hasPlayServices();
  await GoogleSignin.signIn();
  const { idToken } = await GoogleSignin.getTokens();

  // Her API isteğinde güncel Google idToken kullanılsın diye token getter ayarlanır
  setTokenGetter(async () => {
    const tokens = await GoogleSignin.getTokens();
    return tokens.idToken;
  });

  const { data } = await api.post('/auth/login', { idToken });
  return data;
}

/**
 * Email ve şifre ile yeni kullanıcı kaydı oluşturur.
 * Backend JWT token döner ve bu token SecureStore'a kaydedilir.
 *
 * @param email - Kullanıcı email adresi
 * @param password - Kullanıcı şifresi
 * @param displayName - Kullanıcının görünen adı
 * @returns Kullanıcı bilgisi ve varsa abonelik durumu
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<{ user: User; subscription: Subscription | null }> {
  if (MOCK_MODE) {
    return { user: { ...MOCK_USER, email, displayName, authProvider: 'email' }, subscription: null };
  }
  const { data } = await api.post('/auth/register', { email, password, displayName });
  await storeToken(data.token);
  return data;
}

/**
 * Email ve şifre ile mevcut hesaba giriş yapar.
 * Backend JWT token döner ve bu token SecureStore'a kaydedilir.
 *
 * @param email - Kullanıcı email adresi
 * @param password - Kullanıcı şifresi
 * @returns Kullanıcı bilgisi ve varsa abonelik durumu
 */
export async function loginWithEmail(
  email: string,
  password: string,
): Promise<{ user: User; subscription: Subscription | null }> {
  if (MOCK_MODE) {
    return { user: MOCK_USER, subscription: null };
  }
  const { data } = await api.post('/auth/login/email', { email, password });
  await storeToken(data.token);
  return data;
}

/**
 * Kullanıcıyı çıkış yapar — token'ı siler ve Google oturumunu kapatır.
 * Google Sign-In configured değilse hata sessizce yutulur.
 */
export async function signOut() {
  await clearStoredToken();
  if (!MOCK_MODE && GoogleSignin) {
    try {
      await GoogleSignin.signOut();
    } catch {
      // Google Sign-In configured değilse ignore
    }
  }
}

/**
 * Mevcut oturumun kullanıcı bilgilerini backend'den çeker.
 * Navigation component'inde kullanılır — kullanıcının rolünü (USER/RESTAURANT/ADMIN)
 * ve abonelik durumunu belirlemek için.
 *
 * @returns Kullanıcı, abonelik ve varsa restoran profili bilgisi
 */
export async function getMe(): Promise<{ user: User; subscription: Subscription | null; restaurantProfile?: Pick<RestaurantProfile, 'id' | 'status' | 'rejectionReason' | 'businessName' | 'placeId'> | null }> {
  if (MOCK_MODE) return { user: MOCK_USER, subscription: null };
  const { data } = await api.get('/auth/me');
  return data;
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/reset-password', { token, password });
}

export async function verifyEmail(token: string): Promise<void> {
  await api.post('/auth/verify-email', { token });
}

export async function resendVerification(): Promise<void> {
  await api.post('/auth/resend-verification');
}

/**
 * Uygulama yeniden başlatıldığında oturumu geri yükler.
 * SecureStore'da kayıtlı token varsa token getter'ı ayarlar ve true döner.
 * Token yoksa false döner — kullanıcı onboarding akışına yönlendirilir.
 *
 * Neden bu fonksiyon yazıldı:
 * Kullanıcının her app açılışında tekrar giriş yapmasını önler.
 * Navigation component'inde splash screen sırasında çağrılır.
 *
 * @returns Token bulundu mu (oturum geri yüklenebildi mi)
 */
export async function restoreSession(): Promise<boolean> {
  const token = await getStoredToken();
  if (!token) return false;
  setTokenGetter(getStoredToken);
  return true;
}
