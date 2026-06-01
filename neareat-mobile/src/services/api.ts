/**
 * API İstemci Modülü
 *
 * Tüm backend istekleri bu merkezi axios instance üzerinden yapılır.
 * Bu modül şunları sağlar:
 * - Base URL'in tek noktadan yönetimi (expo config'den okunur)
 * - Her isteğe otomatik Authorization header eklenmesi (interceptor)
 * - 15 saniyelik timeout ile yavaş ağlarda sonsuz beklemenin önlenmesi
 * - ngrok geliştirme tüneli için gerekli header'ın eklenmesi
 */
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';

/**
 * API base URL'i Expo config'den (app.json → extra.apiBaseUrl) alınır.
 * Tanımlı değilse yerel geliştirme sunucusuna (localhost:3000) bağlanır.
 */
const BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:3000/api';

/**
 * Merkezi axios instance — tüm servis dosyaları bu instance'ı kullanır.
 * timeout: 15 saniye — yavaş ağda sonsuza kadar beklemeyi önler.
 * ngrok-skip-browser-warning: ngrok tüneli üzerinden geliştirme yaparken
 * tarayıcı uyarı sayfasının API yanıtını bozmasını engeller.
 */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, // 15 saniye — yavaş ağda sonsuza kadar beklemeyi önle
  headers: { 'ngrok-skip-browser-warning': 'true' },
});

/**
 * Token getter fonksiyonu referansı.
 * Google Auth ve Email Auth farklı token mekanizmaları kullandığından,
 * token alma mantığı dışarıdan enjekte edilir (Strategy Pattern).
 */
let idTokenGetter: (() => Promise<string | null>) | null = null;

/**
 * Token getter fonksiyonunu ayarlar.
 * Auth servisi oturum açıldığında bu fonksiyonu çağırarak
 * token alma stratejisini (Google idToken veya SecureStore JWT) belirler.
 *
 * @param getter - Asenkron token döndüren fonksiyon
 */
export function setTokenGetter(getter: () => Promise<string | null>) {
  idTokenGetter = getter;
}

/** SSE streaming gibi axios dışı fetch isteklerinde kullanmak için token al. */
export async function getToken(): Promise<string | null> {
  if (!idTokenGetter) return null;
  return idTokenGetter();
}

export { BASE_URL };

/**
 * Request interceptor — her API isteğinden önce otomatik çalışır.
 * Token getter mevcutsa, token'ı alır ve Authorization header'ına ekler.
 * Bu sayede her servis fonksiyonunda manuel token eklemeye gerek kalmaz.
 */
api.interceptors.request.use(async (config) => {
  if (idTokenGetter) {
    const token = await idTokenGetter();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/**
 * Bir axios hatasını kullanıcıya gösterilebilecek anlamlı Türkçe mesaja çevirir.
 * Ham "Request failed with status code 500" gibi mesajlar yerine kullanılır.
 *
 * Ekranlar `error.userMessage` (interceptor tarafından eklenir) veya doğrudan
 * bu fonksiyonu kullanabilir.
 */
export function getApiErrorMessage(error: any): string {
  if (error?.response) {
    const status = error.response.status;
    if (status >= 500) return 'Sunucuda bir sorun oluştu. Lütfen biraz sonra tekrar dene.';
    // 4xx — sunucunun verdiği Türkçe mesajı tercih et
    return error.response.data?.error || 'Bir şeyler ters gitti. Lütfen tekrar dene.';
  }
  if (error?.code === 'ECONNABORTED') {
    return 'İstek zaman aşımına uğradı. Bağlantını kontrol edip tekrar dene.';
  }
  return 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.';
}

/**
 * Response interceptor — merkezi hata yönetimi:
 * - 401 (oturum dolması, yalnızca giriş yapmış kullanıcıda): token getter'ı sıfırla
 *   + oturumu kapat → navigation otomatik login ekranına yönlendirir.
 *   (Giriş denemesindeki 401 — örn. "E-posta veya şifre hatalı" — dokunulmaz,
 *    sunucu mesajı kullanıcıya gösterilir.)
 * - Diğer tüm hatalara anlamlı `userMessage` eklenir.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthenticated = !!useAuthStore.getState().user;
    if (error?.response?.status === 401 && isAuthenticated) {
      idTokenGetter = null;
      // logout SecureStore token'ı siler + state'i temizler (fire-and-forget)
      useAuthStore.getState().logout().catch(() => {});
      error.userMessage = 'Oturumun sona erdi. Lütfen tekrar giriş yap.';
    } else {
      error.userMessage = getApiErrorMessage(error);
    }
    return Promise.reject(error);
  },
);

export default api;
