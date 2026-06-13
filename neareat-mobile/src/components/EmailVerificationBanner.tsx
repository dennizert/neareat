import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../theme';
import type { Colors } from '../theme';
import { resendVerification } from '../services/auth';
import { getApiErrorMessage } from '../services/api';
import { shouldShowVerifyBanner } from '../utils/emailVerification';
import AppIcon from './AppIcon';

// Doğrulanmamış e-posta hesaplarına ana ekranda gösterilen, kapatılabilir uyarı bandı.
// "Tekrar gönder" ile doğrulama e-postasını yeniden ister; 429/limit hatasını toast'la bildirir.
export default function EmailVerificationBanner() {
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  if (dismissed || !shouldShowVerifyBanner(user)) return null;

  async function onResend() {
    setSending(true);
    try {
      await resendVerification();
      toast.show('Doğrulama e-postası gönderildi. Gelen kutunu kontrol et.', 'success');
    } catch (err: any) {
      toast.show(err?.userMessage || getApiErrorMessage(err), 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.banner}>
      <AppIcon name="info" size={18} color={C.warning} />
      <Text style={styles.text}>E-posta adresini doğrula. Bazı işlemler için gereklidir.</Text>
      <TouchableOpacity onPress={onResend} disabled={sending} style={styles.action}>
        {sending
          ? <ActivityIndicator size="small" color={C.primary} />
          : <Text style={styles.actionText}>Tekrar gönder</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <AppIcon name="close" size={16} color={C.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.warningSurface ?? C.surfaceAlt,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    text: { flex: 1, fontSize: 13, color: C.textPrimary },
    action: { paddingHorizontal: 8, paddingVertical: 4 },
    actionText: { fontSize: 13, fontWeight: '700', color: C.primary },
  });
}
