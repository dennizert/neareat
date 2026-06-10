/**
 * RestaurantCampaignScreen — Anlık kampanya gönderimi (Sprint-5 Task #4).
 * Restoran sahibi favori/rezervasyon/hepsi kitlesine özel mesajlı bildirim atar.
 * Backend günde 1 kampanya limiti uygular (429 → CampaignLimitError).
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendCampaign, CampaignLimitError } from '../../services/restaurantAccount';
import type { CampaignAudience } from '../../services/restaurantAccount';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

const MAX_LENGTH = 200;
const MIN_LENGTH = 5;

const AUDIENCES: { key: CampaignAudience; label: string; desc: string }[] = [
  { key: 'all', label: 'Herkes', desc: 'Favorileyenler + rezervasyon yapanlar' },
  { key: 'favorites', label: 'Favorileyenler', desc: 'Restoranı favorileyen kullanıcılar' },
  { key: 'reservations', label: 'Rezervasyon yapanlar', desc: 'Daha önce rezervasyon yapanlar' },
];

export default function RestaurantCampaignScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();

  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<CampaignAudience>('all');
  const [sending, setSending] = useState(false);

  const canSend = message.trim().length >= MIN_LENGTH && !sending;

  const handleSend = useCallback(() => {
    const text = message.trim();
    if (text.length < MIN_LENGTH) return;

    Alert.alert(
      'Kampanyayı gönder?',
      'Bu kampanya hedef kitleye anlık bildirim olarak iletilecek. Günde yalnızca 1 kampanya gönderebilirsin.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Gönder',
          style: 'default',
          onPress: async () => {
            setSending(true);
            try {
              const { sent } = await sendCampaign(text, audience);
              Alert.alert('Kampanya gönderildi', `${sent} kişiye bildirim iletildi.`, [
                { text: 'Tamam', onPress: () => navigation.goBack() },
              ]);
            } catch (err) {
              if (err instanceof CampaignLimitError) {
                Alert.alert('Günlük limit', err.message);
              } else {
                Alert.alert('Hata', 'Kampanya gönderilemedi. Tekrar dene.');
              }
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  }, [message, audience, navigation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: bottom + 16 }]}>
      <Text style={styles.title}>⚡ Anlık Kampanya</Text>
      <Text style={styles.subtitle}>
        Restoranını favorileyen veya rezervasyon yapan kullanıcılara anlık bir bildirim gönder.
        Günde yalnızca 1 kampanya hakkın var.
      </Text>

      <Text style={styles.label}>Mesaj</Text>
      <TextInput
        style={styles.input}
        value={message}
        onChangeText={setMessage}
        placeholder="örn. Bugün 18:00-21:00 arası tüm menüde %20 indirim!"
        placeholderTextColor={C.textMuted}
        maxLength={MAX_LENGTH}
        multiline
        editable={!sending}
      />
      <Text style={styles.counter}>{message.length}/{MAX_LENGTH}</Text>

      <Text style={styles.label}>Hedef kitle</Text>
      {AUDIENCES.map((a) => {
        const active = audience === a.key;
        return (
          <TouchableOpacity
            key={a.key}
            style={[styles.audienceRow, active && styles.audienceRowActive]}
            onPress={() => setAudience(a.key)}
            disabled={sending}
            activeOpacity={0.8}
          >
            <View style={[styles.radio, active && styles.radioActive]}>
              {active && <View style={styles.radioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.audienceLabel, active && styles.audienceLabelActive]}>{a.label}</Text>
              <Text style={styles.audienceDesc}>{a.desc}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={0.85}
      >
        {sending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.sendBtnText}>Kampanyayı Gönder</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    content: { padding: 16, paddingBottom: 32 },
    title: { fontSize: 22, fontWeight: '800', color: C.textPrimary, marginBottom: 6 },
    subtitle: { fontSize: 13, color: C.textTertiary, lineHeight: 19, marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '700', color: C.textSecondary, marginBottom: 8, marginTop: 8 },
    input: {
      backgroundColor: C.surface,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: C.textPrimary,
      borderWidth: 1,
      borderColor: C.border,
      minHeight: 90,
      textAlignVertical: 'top',
    },
    counter: { fontSize: 12, color: C.textMuted, textAlign: 'right', marginTop: 4 },
    audienceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: C.surface,
      borderWidth: 1.5,
      borderColor: C.border,
      marginBottom: 8,
    },
    audienceRowActive: { borderColor: C.primary },
    radio: {
      width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.textMuted,
      alignItems: 'center', justifyContent: 'center',
    },
    radioActive: { borderColor: C.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
    audienceLabel: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
    audienceLabelActive: { color: C.primary },
    audienceDesc: { fontSize: 12, color: C.textTertiary, marginTop: 2 },
    sendBtn: {
      backgroundColor: C.primary,
      paddingVertical: 15,
      borderRadius: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    sendBtnDisabled: { opacity: 0.5 },
    sendBtnText: { color: C.primaryOn, fontWeight: '700', fontSize: 16 },
  });
}
