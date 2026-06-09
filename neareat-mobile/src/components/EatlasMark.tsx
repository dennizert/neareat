import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  /** Rozetin kenar uzunluğu (px). Varsayılan 76. */
  size?: number;
  style?: ViewStyle;
}

// App ikonuyla birebir aynı sıcak palet (coral → turuncu → amber).
const EATLAS_COLORS = ['#FF5A3C', '#FF7A34', '#FFB627'] as const;
const TILE_BG = '#100C16'; // app ikonu zemini (near-black)

/**
 * Eatlas marka rozeti — app ikonunun küçük hâli: koyu yuvarlak tile içinde
 * yatay coral→amber gradient ile maskelenmiş tek harf "E".
 * Login/onboarding gibi ekranlarda hero işareti olarak kullanılır.
 */
export default function EatlasMark({ size = 76, style }: Props) {
  const radius = size * 0.28;       // app ikonu köşe yarıçapı oranı
  const fontSize = size * 0.6;
  const textStyle = {
    fontSize,
    lineHeight: size,
    fontWeight: '900' as const,
    textAlign: 'center' as const,
    includeFontPadding: false,
  };
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: radius },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="Eatlas"
    >
      <MaskedView
        style={{ width: size, height: size }}
        maskElement={<Text style={[textStyle, styles.maskText]}>E</Text>}
      >
        <LinearGradient
          colors={EATLAS_COLORS}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width: size, height: size }}
        >
          <Text style={[textStyle, styles.spacer]}>E</Text>
        </LinearGradient>
      </MaskedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: TILE_BG,
    alignItems: 'center',
    justifyContent: 'center',
    // premium derinlik
    shadowColor: '#FF5A3C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  maskText: { color: '#000' },
  spacer: { opacity: 0 },
});
