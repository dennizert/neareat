import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { forgotPassword } from '../../services/auth';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import EatlasLogo from '../../components/EatlasLogo';
import AppIcon from '../../components/AppIcon';
import AuthInput from '../../components/auth/AuthInput';
import GlowButton from '../../components/auth/GlowButton';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Hata', 'E-posta adresi zorunlu.');
      return;
    }

    try {
      setLoading(true);
      await forgotPassword(trimmed);
      setSent(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Bir sorun oluştu. Lütfen tekrar dene.';
      Alert.alert('Hata', msg);
    } finally {
      setLoading(false);
    }
  }

  const topPad = Math.max(insets.top, 12);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topBar, { top: topPad + 2 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <AppIcon name="back" size={22} color={C.textPrimary} />
          <Text style={styles.backText}>Geri</Text>
        </TouchableOpacity>
        <EatlasLogo size={18} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: topPad + 70 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {sent ? (
          <View style={styles.centerBlock}>
            <View style={[styles.medallion, styles.medallionSuccess]}>
              <AppIcon name="verified" size={40} color={C.success} />
            </View>
            <Text style={styles.title}>E-posta Gönderildi</Text>
            <Text style={styles.subtitle}>
              Eğer bu e-posta Eatlas'ta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.{'\n\n'}
              Gelen kutunu ve spam klasörünü kontrol et.
            </Text>
            <GlowButton label="Giriş Ekranına Dön" onPress={() => navigation.goBack()} style={styles.ctaWide} />
          </View>
        ) : (
          <View style={styles.centerBlock}>
            <View style={styles.medallion}>
              <AppIcon name="lock" size={38} color={C.primary} />
            </View>
            <Text style={styles.title}>Şifremi Unuttum</Text>
            <Text style={styles.subtitle}>
              E-posta adresini gir. Şifre sıfırlama bağlantısı göndereceğiz.
            </Text>

            <View style={styles.form}>
              <AuthInput
                icon="email"
                label="E-posta"
                placeholder="ornek@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                containerStyle={styles.firstField}
              />
              <GlowButton label="Bağlantı Gönder" onPress={handleSend} loading={loading} style={styles.cta} />
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: C.background },
    topBar: {
      position: 'absolute', left: 20, right: 20, zIndex: 10,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    backText: { fontSize: 15, color: C.textPrimary, fontWeight: '600' },

    container: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingBottom: 36 },
    centerBlock: { width: '100%', alignItems: 'center' },

    medallion: {
      width: 84, height: 84, borderRadius: 26, backgroundColor: C.primarySurface,
      alignItems: 'center', justifyContent: 'center', marginBottom: 22,
      borderWidth: 1, borderColor: C.primaryLight,
    },
    medallionSuccess: { backgroundColor: C.successSurface, borderColor: C.successSurface },

    title: { fontSize: 26, fontWeight: '800', color: C.textPrimary, marginBottom: 10, textAlign: 'center', letterSpacing: -0.3 },
    subtitle: { fontSize: 15, color: C.textSecondary, lineHeight: 22, marginBottom: 24, textAlign: 'center', paddingHorizontal: 6 },

    form: { width: '100%' },
    firstField: { marginTop: 0 },
    cta: { marginTop: 22 },
    ctaWide: { marginTop: 8, alignSelf: 'stretch' },
  });
}
