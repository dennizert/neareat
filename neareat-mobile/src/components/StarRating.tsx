import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  rating: number;
  size?: number;
}

export default function StarRating({ rating, size = 14 }: Props) {
  const { C } = useTheme();
  const filled = Math.round(rating);

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => {
        const isOn = i <= filled;
        return (
          <Text
            key={i}
            style={{
              fontSize: size,
              color: isOn ? C.amber : C.borderStrong,
              textShadowColor: isOn ? 'rgba(0,0,0,0.18)' : 'transparent',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: isOn ? 1 : 0,
            }}
          >
            ★
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
