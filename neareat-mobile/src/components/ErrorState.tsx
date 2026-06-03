import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import type { Colors } from '../theme';
import AppIcon from './AppIcon';

interface Props {
  message?: string;
  onRetry: () => void;
  retryLabel?: string;
}

/**
 * S11-3 — Hata durumu: anlamlı mesaj + "Tekrar dene" ile kurtarma.
 */
export default function ErrorState({ message, onRetry, retryLabel = 'Tekrar dene' }: Props) {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <AppIcon name="warning" size={34} color={C.error} />
      </View>
      <Text style={styles.msg}>{message ?? 'Bir şeyler ters gitti. Lütfen tekrar dene.'}</Text>
      <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.85}>
        <AppIcon name="recommend" size={16} color="#fff" />
        <Text style={styles.btnText}>{retryLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
    iconCircle: {
      width: 76, height: 76, borderRadius: 38, backgroundColor: C.errorSurface,
      alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    },
    msg: { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
    btn: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
      backgroundColor: C.primary, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12,
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  });
}
