/**
 * Kimlik Doğrulama Store'u (Zustand)
 *
 * Uygulamanın global auth state'ini yönetir:
 * - Oturum açmış kullanıcı bilgisi
 * - Premium abonelik durumu
 * - Restoran hesabı onay durumu
 * - JWT token
 *
 * Neden Zustand kullanıldı:
 * Redux'a kıyasla çok daha az boilerplate kod gerektirir.
 * Context API'den farklı olarak gereksiz re-render'ları önler —
 * sadece kullanılan slice değiştiğinde component yeniden render edilir.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User, Subscription } from '../types';

/** Restoran hesabının onay durumu bilgisi */
export interface RestaurantStatus {
  /** Onay durumu: PENDING, APPROVED veya REJECTED */
  status: string;
  /** Reddedilme sebebi (sadece REJECTED durumunda dolu) */
  rejectionReason?: string | null;
}

interface AuthState {
  user: User | null;
  pendingUser: User | null;
  subscription: Subscription | null;
  token: string | null;
  restaurantStatus: RestaurantStatus | null;
  setUser: (user: User | null) => void;
  setPendingUser: (user: User | null) => void;
  setSubscription: (sub: Subscription | null) => void;
  setToken: (token: string | null) => void;
  setRestaurantStatus: (status: RestaurantStatus | null) => void;
  isPremium: () => boolean;
  logout: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  pendingUser: null,
  subscription: null,
  token: null,
  restaurantStatus: null,

  /**
   * Aktif kullanıcıyı ayarlar ve pendingUser'ı temizler.
   * Giriş başarılı olduğunda veya getMe() sonrasında çağrılır.
   */
  setUser: (user) => set({ user, pendingUser: null }),

  /**
   * Kayıt akışında henüz onboarding'i tamamlamamış kullanıcıyı tutar.
   * Premium intro ekranı gösterilirken kullanılır.
   */
  setPendingUser: (pendingUser) => set({ pendingUser }),

  /** Abonelik bilgisini günceller */
  setSubscription: (subscription) => set({ subscription }),

  /** JWT token'ı store'da saklar */
  setToken: (token) => set({ token }),

  /** Restoran hesabının onay durumunu günceller */
  setRestaurantStatus: (restaurantStatus) => set({ restaurantStatus }),

  /**
   * Kullanıcının aktif premium aboneliği olup olmadığını kontrol eder.
   * Abonelik durumu 'active' veya 'trial' olmalı VE süresi dolmamış olmalıdır.
   *
   * Neden bu fonksiyon yazıldı:
   * Premium özellikler (favoriler sınırı, popüler saatler, gelişmiş filtreler)
   * bu kontrole göre gösterilir veya Paywall'a yönlendirilir.
   */
  isPremium: () => {
    const sub = get().subscription;
    return (
      !!sub &&
      ['active', 'trial'].includes(sub.status) &&
      new Date(sub.expiresAt) > new Date()
    );
  },

  /**
   * Kullanıcıyı çıkış yapar — SecureStore'daki token'ı siler ve
   * tüm auth state'ini temizler. Navigation otomatik olarak
   * onboarding ekranına yönlendirir (user === null kontrolü ile).
   */
  logout: async () => {
    await SecureStore.deleteItemAsync('neareat_auth_token').catch(() => {});
    set({ user: null, pendingUser: null, subscription: null, token: null, restaurantStatus: null });
  },

  /** Tüm auth state'ini sıfırlar (SecureStore'a dokunmadan) */
  clear: () => set({ user: null, pendingUser: null, subscription: null, token: null, restaurantStatus: null }),
}));
