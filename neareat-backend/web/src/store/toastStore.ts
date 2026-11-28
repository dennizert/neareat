/** Toast kuyruğu — mobil `useToast` karşılığı. */
import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';
export interface ToastItem { id: number; message: string; tone: ToastTone }

interface ToastState {
  items: ToastItem[];
  show: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
const DURATION_MS = 4000;

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  show(message, tone = 'info') {
    const id = ++seq;
    set({ items: [...get().items, { id, message, tone }] });
    setTimeout(() => get().dismiss(id), DURATION_MS);
  },
  dismiss(id) {
    set({ items: get().items.filter((t) => t.id !== id) });
  },
}));

export function toast(message: string, tone: ToastTone = 'info') {
  useToastStore.getState().show(message, tone);
}
