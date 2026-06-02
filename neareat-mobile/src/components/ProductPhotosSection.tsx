import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

interface Props {
  /** Sahibin yüklediği ürün fotoğrafı URL'leri (S10). */
  photos: string[];
  /** Bir fotoya basılınca çağrılır (tam ekran görüntüleyici için). */
  onPressPhoto: (url: string) => void;
}

/**
 * Restoran detayında "Ürün Fotoğrafları" yatay galerisi (S10-6).
 * Foto yoksa hiçbir şey render etmez (bölüm gizli).
 */
export default function ProductPhotosSection({ photos, onPressPhoto }: Props) {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  if (!photos || photos.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Ürün Fotoğrafları</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
        {photos.map((url, i) => (
          <TouchableOpacity
            key={i}
            style={styles.thumb}
            onPress={() => onPressPhoto(url)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: url }} style={styles.thumbImage} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    section: { marginTop: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, marginBottom: 8 },
    thumb: { width: 120, height: 120, borderRadius: 10, overflow: 'hidden', marginRight: 10, backgroundColor: C.inputBg },
    thumbImage: { width: '100%', height: '100%' },
  });
}
