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
  setMyCollections: (myCollections) => set({ myCollections }),
  setSharedWithMe: (sharedWithMe) => set({ sharedWithMe }),
  addCollection: (col) => set((s) => ({ myCollections: [col, ...s.myCollections] })),
  updateCollection: (id, updates) =>
    set((s) => ({
      myCollections: s.myCollections.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  removeCollection: (id) =>
    set((s) => ({ myCollections: s.myCollections.filter((c) => c.id !== id) })),
  clear: () => set({ myCollections: [], sharedWithMe: [] }),
}));
