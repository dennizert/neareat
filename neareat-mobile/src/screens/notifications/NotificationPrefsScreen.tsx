import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Switch, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import type { NotificationType } from '../../types';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../../services/notificationPrefs';

const TYPE_LABELS: Partial<Record<NotificationType, string>> = {
  FRIEND_REQUEST:          'Arkadaşlık İstekleri',
  FRIEND_SUGGESTION:       'Arkadaş Önerileri',
  RECOMMENDATION:          'Restoran Önerileri',
  REVIEW_REPLY:            'Yorum Yanıtları',
  MEAL_GROUP_INVITE:       'Grup Davetleri',
  MEAL_GROUP_POLL:         'Grup Anketleri',
  MEAL_GROUP_POLL_CLOSED:  'Anket Sonuçları',
  INSTANT_DISCOUNT:        'Anlık İndirimler',
  RESERVATION_CONFIRMED:   'Rezervasyon Onayları',
  RESERVATION_REJECTED:    'Rezervasyon Redleri',
  RESERVATION_REMINDER:    'Rezervasyon Hatırlatıcı',
  WEEKLY_DIGEST:           'Haftalık Özet',
  INACTIVITY_REMINDER:     'Hareketsizlik Hatırlatıcı',
};

const SECTIONS = [
  { title: 'Sosyal', types: ['FRIEND_REQUEST', 'FRIEND_SUGGESTION', 'RECOMMENDATION', 'REVIEW_REPLY'] },
  { title: 'Gruplar', types: ['MEAL_GROUP_INVITE', 'MEAL_GROUP_POLL', 'MEAL_GROUP_POLL_CLOSED'] },
  { title: 'Rezervasyon', types: ['RESERVATION_CONFIRMED', 'RESERVATION_REJECTED', 'RESERVATION_REMINDER'] },
  { title: 'Kampanya & Diğer', types: ['INSTANT_DISCOUNT', 'WEEKLY_DIGEST', 'INACTIVITY_REMINDER'] },
] as const;

export default function NotificationPrefsScreen() {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const { bottom } = useSafeAreaInsets();

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getNotificationPreferences()
      .then((data) => {
        const map: Record<string, boolean> = {};
        data.forEach((p) => { map[p.type] = p.enabled; });
        setPrefs(map);
      })
      .catch(() => Alert.alert('Hata', 'Tercihler yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(type: string, value: boolean) {
    setPrefs((prev) => ({ ...prev, [type]: value }));
    setSaving(true);
    try {
      await updateNotificationPreferences([{ type: type as NotificationType, enabled: value }]);
    } catch {
      // Başarısız olursa geri al
      setPrefs((prev) => ({ ...prev, [type]: !value }));
      Alert.alert('Hata', 'Tercih kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.scroll, { paddingBottom: bottom + 16 }]}>
      {saving && (
        <View style={styles.savingBar}>
          <ActivityIndicator size="small" color={C.primary} />
          <Text style={styles.savingText}>Kaydediliyor…</Text>
        </View>
      )}

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.types.map((type, idx) => (
            <View
              key={type}
              style={[
                styles.row,
                idx < section.types.length - 1 && styles.rowBorder,
              ]}
            >
              <Text style={styles.rowLabel}>{TYPE_LABELS[type as NotificationType] ?? type}</Text>
              <Switch
                value={prefs[type] ?? true}
                onValueChange={(v) => handleToggle(type, v)}
                trackColor={{ false: C.disabled, true: C.primaryLight }}
                thumbColor={prefs[type] ?? true ? C.primary : C.textMuted}
              />
            </View>
          ))}
        </View>
      ))}

      <Text style={styles.hint}>
        Kapatılan bildirim türleri gönderilmez. Yüksek öncelikli sistem bildirimleri (seviye atlama, ödül) bu ayardan etkilenmez.
      </Text>
    </ScrollView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },
    scroll: { paddingBottom: 40 },

    savingBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.primaryLight, paddingHorizontal: 16, paddingVertical: 8,
    },
    savingText: { fontSize: 13, color: C.primary, fontWeight: '600' },

    section: {
      backgroundColor: C.surface, marginHorizontal: 16, marginTop: 16,
      borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden',
    },
    sectionTitle: {
      fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase',
      letterSpacing: 0.7, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: C.separator },
    rowLabel: { fontSize: 15, color: C.textPrimary, flex: 1, marginRight: 12 },
    hint: { fontSize: 12, color: C.textMuted, paddingHorizontal: 20, marginTop: 20, lineHeight: 18, textAlign: 'center' },
  });
}
