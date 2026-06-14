import React, { useRef } from 'react';
import { Animated, type ImageProps, type ImageLoadEventData, type NativeSyntheticEvent } from 'react-native';

/**
 * Yüklenince yumuşak fade-in yapan görsel (Sprint-17 #368). Sert "pop-in" yerine
 * 250ms opaklık geçişi. `Image` ile birebir aynı prop'lar (drop-in). RN `Animated`.
 */
export default function FadeInImage(props: ImageProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  const handleLoad = (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    props.onLoad?.(e);
  };

  return <Animated.Image {...props} style={[props.style, { opacity }]} onLoad={handleLoad} />;
}
