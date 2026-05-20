/**
 * Koleksiyon Store'u (Zustand)
 *
 * Kullanıcının restoran koleksiyonlarını (listelerini) yönetir.
 * Koleksiyonlar kullanıcının favori mekanlarını tematik gruplara ayırmasını sağlar
 * (ör. "Romantik Akşam Yemekleri", "Brunch Mekanları").
 * Arkadaşlarla paylaşılabilir.
 */
import { create } from 'zustand';
import type { Collection, SharedCollection } from '../types';

interface CollectionState {
  myCollections: Collection[];
  sharedWithMe: SharedCollection[];
  setMyCollections: (cols: Collection[]) => void;
  setSharedWithMe: (cols: SharedCollection[]) => void;
  addCollection: (col: Collection) => void;
  updateCollection: (id: string, updates: Partial<Collection>) => void;
  removeCollection: (id: string) => void;
  clear: () => void;
}

export const useCollectionStore = create<CollectionState>((set) => ({
  myCollections: [],
  sharedWithMe: [],

  /** Backend'den çekilen kendi koleksiyonlarını store'a yazar */
  setMyCollections: (myCollections) => set({ myCollections }),

  /** Arkadaşlar tarafından paylaşılan koleksiyonları store'a yazar */
  setSharedWithMe: (sharedWithMe) => set({ sharedWithMe }),

  /** Yeni oluşturulan koleksiyonu listenin başına ekler */
  addCollection: (col) => set((s) => ({ myCollections: [col, ...s.myCollections] })),

  /** Mevcut koleksiyonu günceller (isim, açıklama veya gizlilik değişikliği) */
  updateCollection: (id, updates) =>
    set((s) => ({
      myCollections: s.myCollections.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  /** Koleksiyonu listeden siler */
  removeCollection: (id) =>
    set((s) => ({ myCollections: s.myCollections.filter((c) => c.id !== id) })),

  /** Çıkış yapıldığında tüm koleksiyon verilerini temizler */
  clear: () => set({ myCollections: [], sharedWithMe: [] }),
}));
