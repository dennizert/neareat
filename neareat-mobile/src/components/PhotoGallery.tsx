import React, { useState } from 'react';
import { View, Image, FlatList, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../theme';
import type { Colors } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
  photos: string[];
}

export default function PhotoGallery({ photos }: Props) {
  const [fullscreen, setFullscreen] = useState<string | null>(null);

  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  if (!photos || photos.length === 0) {
    return <View style={styles.placeholder} />;
  }

  return (
    <>
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        keyExtractor={(_, i) => String(i)}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setFullscreen(item)}>
            <Image source={{ uri: item }} style={styles.image} />
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!fullscreen} transparent animationType="fade">
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setFullscreen(null)}>
          {fullscreen && (
            <Image source={{ uri: fullscreen }} style={styles.fullImage} resizeMode="contain" />
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
  });
}
