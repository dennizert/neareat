import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { requestLocationPermission } from '../../services/location';

export default function LocationPermissionScreen() {
  const navigation = useNavigation<any>();

  async function handleAllow() {
    const granted = await requestLocationPermission();
    if (granted) {
      navigation.navigate('Login');
    }
  }

  function handleSkip() {
    navigation.navigate('Login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📍</Text>
      <Text style={styles.title}>Çevreni keşfet</Text>
      <Text style={styles.description}>
        Yakınındaki en iyi restoranları gösterebilmemiz için konumuna ihtiyacımız var.
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={handleAllow}>
        <Text style={styles.primaryBtnText}>Konuma İzin Ver</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleSkip}>
        <Text style={styles.skipText}>Şimdi değil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' },
  emoji: { fontSize: 72, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 12, textAlign: 'center' },
  description: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  primaryBtn: { backgroundColor: '#FF6B35', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48, marginBottom: 16 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skipText: { color: '#9CA3AF', fontSize: 14 },
});
