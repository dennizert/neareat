import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle, type DimensionValue } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * S11-3 — Yükleme iskeleti (nabız animasyonu).
 * Spinner yerine içerik düzenini taklit eden kutular için yapı taşı.
 * RN Animated (yeni dep yok); native driver → jest'te no-op, üretimde akıcı.
 */
export default function Skeleton({ width = '100%', height = 16, radius = 8, style }: Props) {
  const { C } = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: C.surfaceAlt, opacity: pulse }, style]}
    />
  );
}

/** Liste için hazır kart iskeleti satırı (görsel + iki metin çizgisi). */
export function SkeletonCard() {
  const styles = makeStyles();
  return (
    <View style={styles.card}>
      <Skeleton height={150} radius={12} />
      <View style={styles.body}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    card: { marginBottom: 16 },
    body: { paddingTop: 10, gap: 8 },
  });
}
