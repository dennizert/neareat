/** Kabuktaki rozet sayıları: bekleyen rezervasyon (yan menü) ve okunmamış bildirim (zil). */
import { create } from 'zustand';
import { getRestaurantReservations } from '../services/reservations';
import { getUnreadCount } from '../services/notifications';

interface CountsState {
  pending: number | null;
  unread: number | null;
  refreshPending: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  setPending: (n: number) => void;
  setUnread: (n: number) => void;
  reset: () => void;
}

export const useCountsStore = create<CountsState>((set) => ({
  pending: null,
  unread: null,
  async refreshPending() {
    try {
      const list = await getRestaurantReservations('PENDING');
      set({ pending: list.length });
    } catch {}
  },
  async refreshUnread() {
    try {
      set({ unread: await getUnreadCount() });
    } catch {}
  },
  setPending: (pending) => set({ pending }),
  setUnread: (unread) => set({ unread }),
  reset: () => set({ pending: null, unread: null }),
}));
