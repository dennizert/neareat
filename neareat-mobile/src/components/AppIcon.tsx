import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { ICONS, FALLBACK_ICON, type IconName } from '../theme/icons';

interface Props {
  /** Semantik ikon adı (theme/icons.ts) — emoji yerine bunu kullan. */
  name: IconName;
  size?: number;
  /** Verilmezse temadan textPrimary. */
  color?: string;
  style?: React.ComponentProps<typeof Ionicons>['style'];
}

/**
 * S11-1 — Tüm uygulamada tek ikon dili.
 * Kullanım: <AppIcon name="phone" /> · <AppIcon name="heart" size={20} color={C.primary} />
 */
export default function AppIcon({ name, size = 22, color, style }: Props) {
  const { C } = useTheme();
  const glyph = ICONS[name] ?? FALLBACK_ICON;
  return <Ionicons name={glyph} size={size} color={color ?? C.textPrimary} style={style} />;
}
