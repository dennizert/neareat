import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  setDark: (value: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: true,
      toggle: () => set(s => ({ isDark: !s.isDark })),
      setDark: (value: boolean) => set({ isDark: value }),
    }),
    {
      name: 'neareat-theme',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
