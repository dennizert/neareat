import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { requestLocationPermission } from '../../services/location';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

export default function LocationPermissionScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

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

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: C.surface },
    emoji: { fontSize: 72, marginBottom: 24 },
    title: { fontSize: 28, fontWeight: '700', color: C.textPrimary, marginBottom: 12, textAlign: 'center' },
    description: { fontSize: 16, color: C.textTertiary, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
    primaryBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48, marginBottom: 16 },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    skipText: { color: C.textMuted, fontSize: 14 },
  });
}
