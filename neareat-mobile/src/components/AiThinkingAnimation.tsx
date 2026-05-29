import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

/**
 * "Bugün Ne Yesem" — AI animasyonu
 *
 * Konsept: yapay zekâ düşünüyor. Üç orbit noktası mor küre etrafında dönüyor,
 * küre nabız atıyor. Altta dönen "düşünme adımları" metni + AI tonlu shimmer kartlar.
 *
 * Tüm animasyonlar tek native-driver Animated.Value döngülerinden interpolasyonla
 * türetildi → JS thread'i bloke etmez.
 */

const STEPS = [
  'Damak zevkin analiz ediliyor…',
  'Yakındaki mekânlar taranıyor…',
  'Sana özel seçenekler hazırlanıyor…',
  'Son rötuşlar atılıyor…',
];

const SCREEN_W = Dimensions.get('window').width;

export default function AiThinkingAnimation() {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const orbit = useRef(new Animated.Value(0)).current;   // 0..1 → 360°
  const pulse = useRef(new Animated.Value(0)).current;   // 0..1 ping-pong
  const shimmer = useRef(new Animated.Value(0)).current; // 0..1 linear

  const [stepIdx, setStepIdx] = useState(0);
  const [textOpacity] = useState(new Animated.Value(1));

  useEffect(() => {
    Animated.loop(
      Animated.timing(orbit, {
        toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true,
      }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true,
      }),
    ).start();
  }, [orbit, pulse, shimmer]);

  // Step rotator + fade
  useEffect(() => {
    const t = setInterval(() => {
      Animated.timing(textOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setStepIdx(i => (i + 1) % STEPS.length);
        Animated.timing(textOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
    }, 1700);
    return () => clearInterval(t);
  }, [textOpacity]);

  // Interpolations
  const coreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
  const coreOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  const rot = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const shimmerTx = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-SCREEN_W, SCREEN_W] });

  const Shimmer = () => (
    <Animated.View
      pointerEvents="none"
      style={[styles.shimmerBar, { transform: [{ translateX: shimmerTx }, { skewX: '-20deg' }] }]}
    />
  );

  return (
    <View style={styles.container}>
      {/* Yıldız orbit + nabız atan çekirdek */}
      <View style={styles.orbitWrap}>
        {/* Dış halo */}
        <Animated.View
          style={[
            styles.glow,
            { transform: [{ scale: glowScale }], opacity: glowOpacity },
          ]}
        />

        {/* Orbit grup */}
        <Animated.View style={[styles.orbit, { transform: [{ rotate: rot }] }]}>
          <View style={[styles.orbitDot, styles.dotA]} />
          <View style={[styles.orbitDot, styles.dotB]} />
          <View style={[styles.orbitDot, styles.dotC]} />
        </Animated.View>

        {/* Çekirdek küre */}
        <Animated.View
          style={[
            styles.core,
            { transform: [{ scale: coreScale }], opacity: coreOpacity },
          ]}
        >
          <Text style={styles.coreIcon}>✨</Text>
        </Animated.View>
      </View>

      {/* Dönen düşünme metni */}
      <Animated.Text style={[styles.stepText, { opacity: textOpacity }]} numberOfLines={1}>
        {STEPS[stepIdx]}
      </Animated.Text>

      {/* AI-tonlu shimmer kart placeholder'ları */}
      <View style={styles.cards}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardPill}><Shimmer /></View>
            <View style={styles.cardBar}><Shimmer /></View>
            <View style={styles.cardBarShort}><Shimmer /></View>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(C: Colors) {
  const ORBIT_RADIUS = 56;
  const DOT = 14;
  return StyleSheet.create({
    container: {
      paddingTop: 24,
      paddingHorizontal: 16,
      alignItems: 'center',
    },

    orbitWrap: {
      width: 160, height: 160,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 24,
    },
    glow: {
      position: 'absolute',
      width: 140, height: 140, borderRadius: 70,
      backgroundColor: C.ai,
    },
    orbit: {
      position: 'absolute',
      width: ORBIT_RADIUS * 2, height: ORBIT_RADIUS * 2,
    },
    orbitDot: {
      position: 'absolute',
      width: DOT, height: DOT, borderRadius: DOT / 2,
    },
    // Üç dot 120° açıyla yerleşmiş (cos/sin manuel)
    dotA: {
      top: 0, left: ORBIT_RADIUS - DOT / 2,
      backgroundColor: '#22D3EE',
      shadowColor: '#22D3EE', shadowOpacity: 0.8, shadowRadius: 6,
    },
    dotB: {
      bottom: 14, left: 4,
      backgroundColor: '#8B5CF6',
      shadowColor: '#8B5CF6', shadowOpacity: 0.8, shadowRadius: 6,
    },
    dotC: {
      bottom: 14, right: 4,
      backgroundColor: '#22D3EE',
      shadowColor: '#22D3EE', shadowOpacity: 0.8, shadowRadius: 6,
    },

    core: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: C.ai,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: C.ai, shadowOpacity: 0.6, shadowRadius: 14, elevation: 8,
    },
    coreIcon: { fontSize: 28 },

    stepText: {
      fontSize: 15, fontWeight: '600',
      color: C.ai,
      marginBottom: 28,
      letterSpacing: 0.3,
      textAlign: 'center',
    },

    cards: { width: '100%' },
    card: {
      backgroundColor: C.aiSurface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.aiLight,
      overflow: 'hidden',
    },
    cardPill: {
      height: 18, width: 80,
      backgroundColor: C.aiLight,
      borderRadius: 9,
      marginBottom: 10,
      overflow: 'hidden',
    },
    cardBar: {
      height: 12, width: '90%',
      backgroundColor: C.aiLight,
      borderRadius: 4,
      marginBottom: 8,
      overflow: 'hidden',
    },
    cardBarShort: {
      height: 10, width: '55%',
      backgroundColor: C.aiLight,
      borderRadius: 4,
      overflow: 'hidden',
    },

    shimmerBar: {
      position: 'absolute',
      top: -10, bottom: -10, width: 80,
      backgroundColor: C.ai, opacity: 0.20,
    },
  });
}
