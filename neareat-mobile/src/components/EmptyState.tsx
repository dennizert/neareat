import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import type { Colors } from '../theme';
import AppIcon from './AppIcon';
import type { IconName } from '../theme/icons';

interface Props {
  title: string;
  description?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * S11-3 — Boş durum: ikon + başlık + açıklama + opsiyonel yönlendirici aksiyon.
 * "Henüz yok" yerine "ne yapmalı" mesajı verir.
 */
export default function EmptyState({ title, description, icon = 'info', actionLabel, onAction }: Props) {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <AppIcon name={icon} size={36} color={C.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.btn} onPress={onAction} activeOpacity={0.85}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
    iconCircle: {
      width: 76, height: 76, borderRadius: 38, backgroundColor: C.surfaceAlt,
      alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    },
    title: { fontSize: 17, fontWeight: '700', color: C.textSecondary, textAlign: 'center' },
    desc: { fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19, marginTop: 2 },
    btn: { marginTop: 16, backgroundColor: C.primary, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  });
}
