/**
 * Kullanıcı Profil Store'u (Zustand)
 *
 * Giriş yapan kullanıcının profil bilgilerini ve yıldız geçmişini yönetir.
 * Profil ekranı, ödüller ekranı ve seviye göstergeleri bu store'u kullanır.
 *
 * Yıldız sistemi: Kullanıcılar yorum yapma, öneri gönderme, arkadaş ekleme
 * gibi aksiyonlarla yıldız kazanır. Yıldız sayısına göre seviye atlanır
 * ve rozetler açılır. Seviye arttıkça restoran indirimi de artar.
 */
import { create } from 'zustand';
import type { UserProfile, StarEvent } from '../types';
import { getLevel } from '../services/social';

interface UserProfileState {
  profile: UserProfile | null;
  starEvents: StarEvent[];
  setProfile: (profile: UserProfile) => void;
  setStarEvents: (events: StarEvent[]) => void;
  updateProfile: (fields: Partial<UserProfile>) => void;
  addStarEvent: (event: StarEvent) => void;
  clear: () => void;
}

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  profile: null,
  starEvents: [],

  /** Profil bilgisini store'a yazar */
  setProfile: (profile) => set({ profile }),

  /** Yıldız geçmişi listesini store'a yazar */
  setStarEvents: (events) => set({ starEvents: events }),

  /**
   * Profil alanlarını kısmen günceller ve seviye bilgisini yeniden hesaplar.
   * Profil düzenleme ekranından döndüğünde çağrılır.
   * Yıldız sayısı değiştiyse seviye ve rozet otomatik güncellenir.
   */
  updateProfile: (fields) => {
    const p = get().profile;
    if (!p) return;
    const newStars = fields.starCount ?? p.starCount;
    const levelData = getLevel(newStars);
    set({ profile: { ...p, ...fields, ...levelData } });
  },

  /**
   * Yeni yıldız olayı ekler ve profildeki toplam yıldız sayısını günceller.
   * Yorum yazma, öneri gönderme gibi aksiyonlardan sonra çağrılır.
   * Seviye ve rozet bilgisi otomatik yeniden hesaplanır.
   *
   * @param event - Kazanılan yıldız olayı (tür, miktar, açıklama)
   */
  addStarEvent: (event) => {
    const p = get().profile;
    if (!p) return;
    const newStarCount = p.starCount + event.amount;
    const levelData = getLevel(newStarCount);
    set({
      profile: { ...p, starCount: newStarCount, ...levelData },
      starEvents: [event, ...get().starEvents],
    });
  },

  /** Çıkış yapıldığında profil ve yıldız verilerini temizler */
  clear: () => set({ profile: null, starEvents: [] }),
}));
