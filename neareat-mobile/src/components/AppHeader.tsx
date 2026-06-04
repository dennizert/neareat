import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EatlasLogo from './EatlasLogo';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

interface Props {
  /** Ortada gösterilecek role özel içerik (Liste/Harita, görünen ad, admin adı...). */
  center?: React.ReactNode;
  /** Sağdaki aksiyonlar (bildirim, çıkış, loglar...). */
  right?: React.ReactNode;
}

/**
 * #255 — Tüm rollerde ortak header.
 * Sol: Eatlas logosu · Orta: role özel içerik · Sağ: aksiyonlar.
 * Açık zemin + safe-area; her rolde aynı görünüm.
 */
export default function AppHeader({ center, right }: Props) {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <EatlasLogo size={22} />
      <View style={styles.center}>{center}</View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: C.surface,
      gap: 8,
    },
    center: { flex: 1, alignItems: 'center' },
    right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  });
}
