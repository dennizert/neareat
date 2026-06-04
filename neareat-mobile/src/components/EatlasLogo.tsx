import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  /** Font boyutu (varsayılan 22 — Home header'ı ile aynı). */
  size?: number;
}

// Marka sıcak paleti: coral → turuncu → amber.
// "Eat" coral'dan turuncuya, "Atlas" turuncudan amber'e akar → birlikte
// kesintisiz sıcak bir geçiş; aralarındaki ince boşlukla iki kelime ayrışır.
const EAT_COLORS = ['#FF5A3C', '#FF7A34'] as const;   // coral → turuncu
const ATLAS_COLORS = ['#FF8E2E', '#FFB627'] as const; // turuncu → amber

function GradientWord({ text, colors, size }: { text: string; colors: readonly [string, string]; size: number }) {
  const textStyle = { fontSize: size, fontWeight: '800' as const, letterSpacing: 0.2 };
  return (
    <MaskedView
      maskElement={<Text style={textStyle}>{text}</Text>}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Görünmez metin: gradient'e maskenin boyutunu verir */}
        <Text style={[textStyle, styles.spacer]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

/**
 * #254 — Eatlas logosu: "Eat" + "Atlas" yumuşak coral→amber gradient'le.
 * İki kelime ince boşlukla ayrışır, geçiş keskin değildir.
 */
export default function EatlasLogo({ size = 22 }: Props) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Eatlas">
      <GradientWord text="Eat" colors={EAT_COLORS} size={size} />
      <View style={styles.gap} />
      <GradientWord text="Atlas" colors={ATLAS_COLORS} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  // "Eat" ile "Atlas" arasında ince ayrışma boşluğu
  gap: { width: Platform.select({ ios: 2, default: 1 }) },
  spacer: { opacity: 0 },
});
