import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User, Subscription } from '../types';

export interface RestaurantStatus {
  status: string;
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
  setUser: (user) => set({ user, pendingUser: null }),
  setPendingUser: (pendingUser) => set({ pendingUser }),
  setSubscription: (subscription) => set({ subscription }),
  setToken: (token) => set({ token }),
  setRestaurantStatus: (restaurantStatus) => set({ restaurantStatus }),
  isPremium: () => {
    const sub = get().subscription;
    return (
      !!sub &&
      ['active', 'trial'].includes(sub.status) &&
      new Date(sub.expiresAt) > new Date()
    );
  },
  logout: async () => {
    await SecureStore.deleteItemAsync('neareat_auth_token').catch(() => {});
    set({ user: null, pendingUser: null, subscription: null, token: null, restaurantStatus: null });
  },
  clear: () => set({ user: null, pendingUser: null, subscription: null, token: null, restaurantStatus: null }),
}));
