import React, { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import { haptics } from '../utils/haptics';

/**
 * Basışta hafifçe küçülen + haptik veren dokunma sarmalayıcısı (Sprint-17 #368).
 * RN `Animated` ile (kod tabanının mevcut animasyon deseni — Skeleton/Toast gibi).
 * `onPress` API'siyle uyumlu drop-in; erişilebilirlik prop'ları Pressable'a geçer.
 */
interface Props extends Omit<PressableProps, 'style' | 'children'> {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number; // basılıyken hedef ölçek (varsayılan 0.97)
  haptic?: boolean; // basışta haptik (varsayılan true)
}

export default function PressableScale({
  onPress, children, style, scaleTo = 0.97, haptic = true, disabled, accessibilityRole = 'button', ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  return (
    <Pressable
      onPressIn={() => { if (!disabled) animateTo(scaleTo); }}
      onPressOut={() => { if (!disabled) animateTo(1); }}
      onPress={() => {
        if (disabled) return;
        if (haptic) haptics.light();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
