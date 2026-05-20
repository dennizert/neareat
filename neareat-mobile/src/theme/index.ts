import { useThemeStore } from '../store/themeStore';

export const lightColors = {
  // Backgrounds
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F4F6',
  surfaceElevated: '#FFFFFF',

  // Text
  textPrimary: '#111827',
  textSecondary: '#374151',
  textTertiary: '#6B7280',
  textMuted: '#9CA3AF',

  // Borders & dividers
  border: '#E5E7EB',
  separator: '#F3F4F6',

  // Input
  inputBg: '#F3F4F6',
  placeholder: '#9CA3AF',

  // Brand
  primary: '#FF6B35',
  primaryLight: '#FFE8DF',
  primaryLighter: '#FFF3EF',
  primarySurface: '#FFFAF7',

  // Status
  success: '#10B981',
  successSurface: '#F0FDF4',
  warning: '#F59E0B',
  warningSurface: '#FFFBEB',
  error: '#EF4444',
  errorSurface: '#FEF2F2',

  // Misc
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
  disabled: '#D1D5DB',
};

export const darkColors: typeof lightColors = {
  // Backgrounds
  background: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#334155',
  surfaceElevated: '#253044',

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',
  textMuted: '#64748B',

  // Borders & dividers
  border: '#334155',
  separator: '#1E293B',

  // Input
  inputBg: '#1E293B',
  placeholder: '#64748B',

  // Brand
  primary: '#FF6B35',
  primaryLight: '#3D200E',
  primaryLighter: '#2A1508',
  primarySurface: '#1F130A',

  // Status
  success: '#10B981',
  successSurface: '#052E16',
  warning: '#F59E0B',
  warningSurface: '#1C1408',
  error: '#EF4444',
  errorSurface: '#1F0A0A',

  // Misc
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.7)',
  disabled: '#374151',
};

export type Colors = typeof lightColors;

export function useTheme() {
  const isDark = useThemeStore(s => s.isDark);
  const C = isDark ? darkColors : lightColors;
  return { isDark, C };
}
