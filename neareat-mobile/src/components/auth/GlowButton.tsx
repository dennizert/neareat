import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * Premium ana CTA — dolu coral + coral "glow" gölgesi. Tema kontrastına uygun
 * (açık: beyaz metin, koyu: koyu metin → C.primaryOn).
 */
export default function GlowButton({ label, onPress, loading, disabled, style }: Props) {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const off = loading || disabled;
  return (
    <TouchableOpacity
      style={[styles.btn, off && styles.disabled, style]}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
    >
      {loading ? <ActivityIndicator color={C.primaryOn} /> : <Text style={styles.text}>{label}</Text>}
    </TouchableOpacity>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    btn: {
      backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
      shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
    },
    disabled: { opacity: 0.6 },
    text: { color: C.primaryOn, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  });
}
