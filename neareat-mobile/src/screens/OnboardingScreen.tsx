import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import type { Colors } from '../theme';
import AppIcon from '../components/AppIcon';
import type { IconName } from '../theme/icons';
import { requestLocationPermission } from '../services/location';
import { haptics } from '../utils/haptics';

interface Slide {
  icon: IconName;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'recommend',
    title: 'Ne yesem? Sana sorulsun.',
    description: 'Yapay zekâ damak tadını öğrenir, "bu akşam nereye?" kararını saniyeler içinde verir.',
  },
  {
    icon: 'filter',
    title: 'Konuşur gibi daralt',
    description: '"Daha ucuz", "daha yakın", "daha sessiz" de — gerisini Eatlas halletsin.',
  },
  {
    icon: 'social',
    title: 'Arkadaşlarının gerçek tavsiyesi',
    description: 'Arkadaşlarının beğendiği mekanları gör. Reklam değil, gerçek tavsiye.',
  },
  {
    icon: 'location',
    title: 'Yakındakileri görelim',
    description: 'Konumunla en yakın ve en iyi mekanları önerebilmemiz için izin vermen yeterli.',
  },
];

/**
 * S11-10 — İlk açılış onboarding'i + son adımda konum izni priming'i.
 * `onDone` çağrıldığında çağıran taraf "görüldü" bayrağını kalıcılaştırır.
 */
export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { C } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  function next() {
    haptics.light();
    setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
  }

  async function finish() {
    haptics.light();
    // İzin priming: açıklamadan SONRA OS iznini iste (kabul oranı artar).
    try { await requestLocationPermission(); } catch { /* reddetse de devam */ }
    onDone();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.topBar}>
        {!isLast ? (
          <TouchableOpacity onPress={onDone} hitSlop={10}>
            <Text style={styles.skip}>Atla</Text>
          </TouchableOpacity>
        ) : <View />}
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <AppIcon name={slide.icon} size={56} color={C.primary} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.desc}>{slide.description}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.btn} onPress={isLast ? finish : next} activeOpacity={0.85}>
          <Text style={styles.btnText}>{isLast ? 'İzin Ver ve Başla' : 'İleri'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 28 },
    topBar: { height: 32, alignItems: 'flex-end', justifyContent: 'center' },
    skip: { fontSize: 14, fontWeight: '600', color: C.textMuted },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    iconCircle: {
      width: 132, height: 132, borderRadius: 66, backgroundColor: C.primaryLighter,
      alignItems: 'center', justifyContent: 'center', marginBottom: 18,
    },
    title: { fontSize: 24, fontWeight: '800', color: C.textPrimary, textAlign: 'center' },
    desc: { fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
    footer: { gap: 20 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
    dotActive: { backgroundColor: C.primary, width: 22 },
    btn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
}
