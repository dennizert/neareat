import React from 'react';
import { Text, StyleSheet } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  /** Font boyutu (varsayılan 22 — Home header'ı ile aynı). */
  size?: number;
}

// Marka sıcak paleti: tek "Eatlas" kelimesi boyunca soldan sağa yumuşak geçer.
// Sol (Eat) coral'a, sağ (atlas) amber'e yakın görünür; kelime bütünlüğü bozulmaz.
const EATLAS_COLORS = ['#FF5A3C', '#FF7A34', '#FFB627'] as const; // coral → turuncu → amber

/**
 * #260 — Eatlas logosu: TEK kelime "Eatlas", soldan sağa yumuşak coral→amber
 * gradient'le maskelenir (kelime bölünmez).
 */
export default function EatlasLogo({ size = 22 }: Props) {
  const textStyle = { fontSize: size, fontWeight: '800' as const, letterSpacing: 0.2 };
  return (
    <MaskedView
      accessibilityRole="header"
      accessibilityLabel="Eatlas"
      maskElement={<Text style={textStyle}>Eatlas</Text>}
    >
      <LinearGradient
        colors={EATLAS_COLORS}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
      >
        {/* Görünmez metin: gradient'e maskenin boyutunu verir */}
        <Text style={[textStyle, styles.spacer]}>Eatlas</Text>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  spacer: { opacity: 0 },
});
