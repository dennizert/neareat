import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

/**
 * "Yolda Ne Yesem" — rota animasyonu
 *
 * Konsept: yol/rota planlanıyor. Bir coral pin işareti yatay yolda L→R akar,
 * yol üzerinde 3 amber stop noktası sırayla belirir. Travel teal hat çizgisi.
 *
 * Renkler: teal (rota/yol), coral (gezen pin), amber (durak nokta).
 * Native-driver Animated kullanır.
 */

const STEPS = [
  'Rota hesaplanıyor…',
  'Rota üzeri mekânlar bulunuyor…',
  'En iyi duraklar süzülüyor…',
  'Açılış saatleri kontrol ediliyor…',
];

const { width: SCREEN_W } = Dimensions.get('window');

export default function RouteThinkingAnimation() {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const carriage = useRef(new Animated.Value(0)).current; // 0..1 → soldan sağa
  const stopReveal = useRef(new Animated.Value(0)).current; // 0..1 → 3 stop sırayla
  const shimmer = useRef(new Animated.Value(0)).current;
  const dash = useRef(new Animated.Value(0)).current;     // yol kesik çizgisi akışı

  const [stepIdx, setStepIdx] = useState(0);
  const [textOpacity] = useState(new Animated.Value(1));

  useEffect(() => {
    Animated.loop(
      Animated.timing(carriage, {
        toValue: 1, duration: 2800, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
      }),
    ).start();
    Animated.loop(
      Animated.timing(stopReveal, {
        toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: false,
      }),
    ).start();
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true,
      }),
    ).start();
    Animated.loop(
      Animated.timing(dash, {
        toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true,
      }),
    ).start();
  }, [carriage, stopReveal, shimmer, dash]);

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

  // Yatay yol uzunluğu — viewport - padding
  const ROAD_W = SCREEN_W - 64;
  const PIN_W = 36;
  const carriageTx = carriage.interpolate({
    inputRange: [0, 1],
    outputRange: [0, ROAD_W - PIN_W],
  });

  // Dash drift: kesik çizgi sağa akıyor (yol hareketi hissi)
  const dashTx = dash.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 24],
  });

  // Stop opacities — sırayla belirir
  const stop1 = stopReveal.interpolate({
    inputRange: [0, 0.25, 0.30, 1],
    outputRange: [0, 0, 1, 1],
  });
  const stop2 = stopReveal.interpolate({
    inputRange: [0, 0.5, 0.55, 1],
    outputRange: [0, 0, 1, 1],
  });
  const stop3 = stopReveal.interpolate({
    inputRange: [0, 0.75, 0.8, 1],
    outputRange: [0, 0, 1, 1],
  });
  const stopScale = (av: Animated.AnimatedInterpolation<number>) =>
    av.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  const shimmerTx = shimmer.interpolate({
    inputRange: [0, 1], outputRange: [-SCREEN_W, SCREEN_W],
  });

  const Shimmer = () => (
    <Animated.View
      pointerEvents="none"
      style={[styles.shimmerBar, { transform: [{ translateX: shimmerTx }, { skewX: '-20deg' }] }]}
    />
  );

  // Stop pozisyonları (yolun %25, %50, %75'i)
  const stopXs = [ROAD_W * 0.25 - 10, ROAD_W * 0.5 - 10, ROAD_W * 0.75 - 10];

  return (
    <View style={styles.container}>
      <View style={styles.roadScene}>
        {/* Kesik çizgi yol (hareketli) */}
        <View style={styles.road}>
          {/* Statik düz hat (yol kenarı) */}
          <View style={styles.roadLine} />
          {/* Hareketli kesik çizgi katmanı */}
          <Animated.View style={[styles.dashRow, { transform: [{ translateX: dashTx }] }]}>
            {Array.from({ length: Math.ceil(ROAD_W / 16) + 4 }).map((_, i) => (
              <View key={i} style={styles.dashSeg} />
            ))}
          </Animated.View>
        </View>

        {/* Stop noktaları (sıralı belirir) */}
        {stopXs.map((x, i) => {
          const op = [stop1, stop2, stop3][i];
          return (
            <Animated.View
              key={i}
              style={[
                styles.stop,
                { left: x, opacity: op, transform: [{ scale: stopScale(op) }] },
              ]}
            >
              <View style={styles.stopInner} />
            </Animated.View>
          );
        })}

        {/* Gezen coral pin */}
        <Animated.View style={[styles.car, { transform: [{ translateX: carriageTx }] }]}>
          <Text style={styles.carIcon}>🍴</Text>
        </Animated.View>
      </View>

      {/* Dönen mesaj */}
      <Animated.Text style={[styles.stepText, { opacity: textOpacity }]} numberOfLines={1}>
        {STEPS[stepIdx]}
      </Animated.Text>

      {/* 3 stop kartı placeholder (gerçek RouteRec stop layout'una benzer) */}
      <View style={styles.cards}>
        {[1, 2, 3].map(n => (
          <View key={n} style={styles.card}>
            <View style={styles.stopLabel}>
              <View style={styles.stopLabelBar}><Shimmer /></View>
            </View>
            <View style={styles.cardRow}>
              <View style={styles.cardPhoto}><Shimmer /></View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardBar}><Shimmer /></View>
                <View style={styles.cardBarShort}><Shimmer /></View>
                <View style={styles.cardMetaRow}>
                  <View style={styles.cardPill}><Shimmer /></View>
                  <View style={styles.cardPill}><Shimmer /></View>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: {
      paddingTop: 16,
      paddingHorizontal: 16,
    },

    // Road
    roadScene: {
      height: 72,
      marginBottom: 18,
      justifyContent: 'center',
    },
    road: {
      height: 4,
      width: '100%',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    roadLine: {
      position: 'absolute',
      left: 0, right: 0, height: 2,
      backgroundColor: C.travelSurface,
      borderRadius: 1,
    },
    dashRow: {
      flexDirection: 'row',
      gap: 8,
      width: '120%',
    },
    dashSeg: {
      width: 8, height: 2,
      backgroundColor: C.travel,
      borderRadius: 1,
      opacity: 0.85,
    },

    // Stop nokta
    stop: {
      position: 'absolute',
      top: 24,
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: C.amberSurface,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: C.amber,
    },
    stopInner: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: C.amber,
    },

    // Gezen pin
    car: {
      position: 'absolute',
      top: 16, left: 0,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: C.primary,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: C.primary, shadowOpacity: 0.55, shadowRadius: 8, elevation: 6,
    },
    carIcon: { fontSize: 16 },

    stepText: {
      fontSize: 15, fontWeight: '600',
      color: C.travel,
      marginBottom: 20,
      letterSpacing: 0.3,
      textAlign: 'center',
    },

    // Cards
    cards: { width: '100%' },
    card: {
      backgroundColor: C.surface,
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },
    stopLabel: { marginBottom: 8 },
    stopLabelBar: {
      height: 12, width: 60,
      backgroundColor: C.travelSurface,
      borderRadius: 4,
      overflow: 'hidden',
    },
    cardRow: { flexDirection: 'row', gap: 12 },
    cardPhoto: {
      width: 60, height: 60, borderRadius: 10,
      backgroundColor: C.surfaceAlt,
      overflow: 'hidden',
    },
    cardBar: {
      height: 12, width: '80%',
      backgroundColor: C.surfaceAlt,
      borderRadius: 4,
      marginBottom: 6,
      overflow: 'hidden',
    },
    cardBarShort: {
      height: 10, width: '50%',
      backgroundColor: C.surfaceAlt,
      borderRadius: 4,
      marginBottom: 8,
      overflow: 'hidden',
    },
    cardMetaRow: { flexDirection: 'row', gap: 6 },
    cardPill: {
      height: 14, width: 50,
      backgroundColor: C.surfaceAlt,
      borderRadius: 7,
      overflow: 'hidden',
    },

    shimmerBar: {
      position: 'absolute',
      top: -10, bottom: -10, width: 70,
      backgroundColor: C.travel, opacity: 0.18,
    },
  });
}
