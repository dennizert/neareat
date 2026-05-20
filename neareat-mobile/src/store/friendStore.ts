/**
 * Arkadaşlık Store'u (Zustand)
 *
 * Kullanıcının arkadaş listesini ve bekleyen arkadaşlık isteklerini yönetir.
 * Sosyal özellikler (öneri gönderme, arkadaş profili görüntüleme) için kullanılır.
 */
import { create } from 'zustand';
import type { Friend, FriendRequest } from '../types';

interface FriendState {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  setFriends: (friends: Friend[]) => void;
  addFriend: (friend: Friend) => void;
  removeFriend: (friendId: string) => void;
  setPendingRequests: (requests: FriendRequest[]) => void;
  removeRequest: (requestId: string) => void;
  clear: () => void;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  pendingRequests: [],

  /** Backend'den çekilen arkadaş listesini store'a yazar */
  setFriends: (friends) => set({ friends }),

  /** Yeni arkadaşı listenin başına ekler (istek kabul edildiğinde) */
  addFriend: (friend) => set({ friends: [friend, ...get().friends] }),

  /** Arkadaşı listeden çıkarır (arkadaşlık silindiğinde) */
  removeFriend: (friendId) =>
    set({ friends: get().friends.filter(f => f.id !== friendId) }),

  /** Bekleyen arkadaşlık isteklerini günceller */
  setPendingRequests: (requests) => set({ pendingRequests: requests }),

  /**
   * Tek bir isteği bekleyen listeden çıkarır.
   * İstek kabul veya reddedildiğinde çağrılır — UI'dan anında kaybolur.
   */
  removeRequest: (requestId) =>
    set({ pendingRequests: get().pendingRequests.filter(r => r.id !== requestId) }),

  /** Çıkış yapıldığında tüm arkadaşlık verilerini temizler */
  clear: () => set({ friends: [], pendingRequests: [] }),
}));
