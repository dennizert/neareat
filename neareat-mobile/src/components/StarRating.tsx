import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  rating: number;
  size?: number;
}

export default function StarRating({ rating, size = 14 }: Props) {
  const filled = Math.round(rating);
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={{ fontSize: size, color: i <= filled ? '#F59E0B' : '#D1D5DB' }}>★</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
