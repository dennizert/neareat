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

export default api;
