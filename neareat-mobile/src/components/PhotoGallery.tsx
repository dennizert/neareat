import React, { useState, useRef } from 'react';
import { View, FlatList, TouchableOpacity, Modal, StyleSheet, Dimensions, Text } from 'react-native';
import { Image } from 'expo-image'; // disk/memory cache + yumuşak geçiş
import { useTheme } from '../theme';
import type { Colors } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
  photos: string[];
  /** Fotoğraf analizi callback — butona basılınca şu an görünen foto URL'i ile çağrılır (S7-6). */
  onAnalyze?: (photoUrl: string) => void;
}

export default function PhotoGallery({ photos, onAnalyze }: Props) {
  const [fullscreen, setFullscreen] = useState<string | null>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);

  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  if (!photos || photos.length === 0) {
    return <View style={styles.placeholder} />;
  }

  const currentPhoto = photos[visibleIndex] ?? photos[0];

  return (
    <>
      <View>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          keyExtractor={(_, i) => String(i)}
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={({ viewableItems }) => {
            if (viewableItems[0]?.index != null) setVisibleIndex(viewableItems[0].index);
          }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setFullscreen(item)}>
              <Image source={{ uri: item }} style={styles.image} contentFit="cover" transition={200} cachePolicy="memory-disk" />
            </TouchableOpacity>
          )}
        />
        {onAnalyze && (
          <TouchableOpacity
            style={styles.analyzeBtn}
            onPress={() => onAnalyze(currentPhoto)}
            activeOpacity={0.85}
          >
            <Text style={styles.analyzeBtnText}>🤖 Bu nasıl?</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={!!fullscreen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setFullscreen(null)}>
          {fullscreen && (
            <Image source={{ uri: fullscreen }} style={styles.fullImage} contentFit="contain" transition={150} cachePolicy="memory-disk" />
          )}
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    image: { width: SCREEN_WIDTH, height: 240 },
    placeholder: { height: 240, backgroundColor: C.surfaceAlt },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
    analyzeBtn: {
      position: 'absolute', bottom: 10, right: 12,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: 16,
    },
    analyzeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  });
}
