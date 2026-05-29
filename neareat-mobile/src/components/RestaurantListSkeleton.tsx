import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

/**
 * Eatlas Loading Skeleton — boş beyaz sayfa yerine markalı bekleme deneyimi.
 *
 * 3 katman:
 *  1) Üstte "tatlı bekleme" amber spark + coral pin mini mark (nabız atar)
 *  2) Hareketli durum metni (Konum alınıyor / Yakındaki lezzetler taranıyor...)
 *  3) 6 adet shimmer'lı restoran kartı iskeleti (gerçek RestaurantCard layout'u)
 *
 * Animasyonlar: tek native-driver Animated.Value -> 3 ayrı interpolation.
 * Native driver kullanır, JS thread'i bloke etmez.
 */

const STATUS_LINES = [
  'Konum alınıyor…',
  'Yakındaki lezzetler taranıyor…',
  'Şu an açık olanlar süzülüyor…',
  'En yakındakiler sıralanıyor…',
];

const SCREEN_W = Dimensions.get('window').width;

export default function RestaurantListSkeleton() {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  // 0..1 looping for shimmer & pulse
  const shimmer = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  // status text index (cycles every 1.4s)
  const [statusIdx, setStatusIdx] = React.useState(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    const t = setInterval(() => {
      setStatusIdx(i => (i + 1) % STATUS_LINES.length);
    }, 1400);
    return () => clearInterval(t);
  }, [pulse, shimmer]);

  // Shimmer translateX: -SCREEN_W .. +SCREEN_W (slide gradient across)
  const shimmerTx = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_W, SCREEN_W],
  });

  // Pulse: amber spark scale + opacity
  const sparkScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const sparkOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  // Shared shimmer overlay for any rectangular box
  const Shimmer = () => (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.shimmerBar,
        { transform: [{ translateX: shimmerTx }, { skewX: '-20deg' }] },
      ]}
    />
  );

  return (
    <View style={styles.container}>
      {/* Brand mark — nabız atan amber kalp + coral teardrop */}
      <View style={styles.brandRow}>
        <View style={styles.pinMark}>
          <Animated.View
            style={[
              styles.sparkDot,
              { opacity: sparkOpacity, transform: [{ scale: sparkScale }] },
            ]}
          />
        </View>
        <Text style={styles.statusText}>{STATUS_LINES[statusIdx]}</Text>
      </View>

      {/* Skeleton cards (6 adet) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.photoSlot}>
            <Shimmer />
          </View>
          <View style={styles.info}>
            <View style={styles.titleBar}><Shimmer /></View>
            <View style={styles.metaBar}><Shimmer /></View>
            <View style={styles.bottomRow}>
              <View style={styles.ratingPill}><Shimmer /></View>
              <View style={styles.distancePill}><Shimmer /></View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: C.background,
    },

    // Brand row
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18,
      paddingHorizontal: 4,
    },
    pinMark: {
      width: 28,
      height: 36,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ rotate: '-2deg' }],
    },
    sparkDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: C.amber,
      shadowColor: C.amber,
      shadowOpacity: 0.6,
      shadowRadius: 6,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
      color: C.textSecondary,
      letterSpacing: 0.2,
    },

    // Card skeleton — gerçek RestaurantCard layout'u
    card: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 14,
      marginBottom: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
    },
    photoSlot: {
      width: 90,
      height: 90,
      backgroundColor: C.surfaceAlt,
      overflow: 'hidden',
    },
    info: { flex: 1, padding: 12, justifyContent: 'center' },
    titleBar: {
      height: 14,
      width: '70%',
      backgroundColor: C.surfaceAlt,
      borderRadius: 4,
      marginBottom: 8,
      overflow: 'hidden',
    },
    metaBar: {
      height: 10,
      width: '45%',
      backgroundColor: C.surfaceAlt,
      borderRadius: 4,
      marginBottom: 12,
      overflow: 'hidden',
    },
    bottomRow: { flexDirection: 'row', gap: 8 },
    ratingPill: {
      width: 56,
      height: 18,
      backgroundColor: C.surfaceAlt,
      borderRadius: 9,
      overflow: 'hidden',
    },
    distancePill: {
      width: 72,
      height: 18,
      backgroundColor: C.surfaceAlt,
      borderRadius: 9,
      overflow: 'hidden',
    },

    // Shimmer overlay (RN diagonal-light slide).
    // Translucent coral tint, slides L->R, gives "loading wave" feel.
    shimmerBar: {
      position: 'absolute',
      top: -10,
      bottom: -10,
      width: 90,
      backgroundColor: C.primary,
      opacity: 0.18,
    },
  });
}
