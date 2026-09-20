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
import api from '../services/api';
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
  /**
   * A02 — oturum nesli. Her giriş ve çıkışta artar. `services/api` her isteğe
   * o anki değeri iliştirir; 401 geldiğinde istek ESKİ bir oturuma aitse çıkış
   * yapılmaz. Böylece A'nın gecikmiş 401'i B'yi düşürmez.
   */
  sessionId: number;
  setUser: (user: User | null) => void;
  setPendingUser: (user: User | null) => void;
  setSubscription: (sub: Subscription | null) => void;
  setToken: (token: string | null) => void;
  setRestaurantStatus: (status: RestaurantStatus | null) => void;
  isPremium: () => boolean;
  loadSubscription: () => Promise<void>;
  logout: () => Promise<void>;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  pendingUser: null,
  subscription: null,
  token: null,
  restaurantStatus: null,
  sessionId: 1,

  /**
   * Aktif kullanıcıyı ayarlar ve pendingUser'ı temizler.
   * Giriş başarılı olduğunda veya getMe() sonrasında çağrılır.
   *
   * A02 — kullanıcı DEĞİŞTİĞİNDE oturum nesli ilerler. Aynı kullanıcı için
   * tekrar çağrılması (ör. getMe tazelemesi) nesli ilerletmez; aksi hâlde
   * uçuştaki kendi isteklerimiz eski sayılırdı.
   */
  setUser: (user) => set((s) => ({
    user,
    pendingUser: null,
    sessionId: s.user?.id === user?.id ? s.sessionId : s.sessionId + 1,
  })),

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
   * Sunucudan güncel abonelik durumunu çeker ve store'u günceller.
   *
   * EK-1 (#451) — kapı eskiden `if (!get().token) return` idi. `setToken` kod
   * tabanında YALNIZCA RestaurantRegisterScreen'de çağrılıyor; normal e-posta ve
   * Google girişleri çağırmıyor ve store persist edilmiyor. Yani `token` normal
   * giriş yapan herkeste null kalıyor ve bu fonksiyon HİÇ çalışmıyordu —
   * App.tsx'teki "öne gelince aboneliği tazele" akışı sessizce ölüydü.
   * Doğru koşul oturumun varlığı: giriş yapmış kullanıcı.
   */
  loadSubscription: async () => {
    if (!get().user) return;
    try {
      const { data } = await api.get<Subscription>('/subscriptions');
      set({ subscription: data });
    } catch {
      // Sessiz hata — mevcut abonelik state'i korunur
    }
  },

  /**
   * Kullanıcıyı çıkış yapar — SecureStore'daki token'ı siler ve
   * tüm auth state'ini temizler. Navigation otomatik olarak
   * onboarding ekranına yönlendirir (user === null kontrolü ile).
   */
  logout: async () => {
    await SecureStore.deleteItemAsync('neareat_auth_token').catch(() => {});
    // A02 — nesil ilerler: bu oturuma ait uçuştaki isteklerin 401'i artık
    // bir sonraki kullanıcıyı etkileyemez.
    set((s) => ({
      user: null, pendingUser: null, subscription: null, token: null,
      restaurantStatus: null, sessionId: s.sessionId + 1,
    }));
  },

  /** Tüm auth state'ini sıfırlar (SecureStore'a dokunmadan) */
  clear: () => set((s) => ({
    user: null, pendingUser: null, subscription: null, token: null,
    restaurantStatus: null, sessionId: s.sessionId + 1,
  })),
}));
