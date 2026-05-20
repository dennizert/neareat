import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { getFriendSuggestions } from '../../services/social';
import { sendFriendRequest } from '../../services/social';
import type { FriendSuggestion } from '../../types';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

const MAX_SCORE = 190;

export default function FriendSuggestionsScreen() {
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    getFriendSuggestions()
      .then(setSuggestions)
      .catch(() => Alert.alert('Hata', 'Öneriler yüklenemedi.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(userId: string) {
    try {
      await sendFriendRequest(userId);
      setSentRequests(prev => new Set(prev).add(userId));
    } catch {
      Alert.alert('Hata', 'İstek gönderilemedi.');
    }
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color={C.primary} />;
  }

  if (suggestions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>Henüz öneri yok</Text>
        <Text style={styles.emptyDesc}>
          Favori, liste ve mutfak tercihlerin arttıkça sana daha iyi arkadaş önerileri sunabiliriz.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={suggestions}
      keyExtractor={item => item.userId}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const pct = Math.min(Math.round((item.matchScore / MAX_SCORE) * 100), 100);
        const sent = sentRequests.has(item.userId);
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarIcon}>👤</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.name}>{item.maskedName}</Text>
                <Text style={styles.badge}>{item.badgeIcon} {item.badge}</Text>
                {item.city && <Text style={styles.city}>📍 {item.city}</Text>}
              </View>
              <View style={styles.scoreBlock}>
                <Text style={styles.scoreNum}>{pct}%</Text>
                <Text style={styles.scoreLabel}>eşleşme</Text>
              </View>
            </View>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
            </View>

            {item.matchReasons.length > 0 && (
              <View style={styles.reasonsRow}>
                {item.matchReasons.map((r, i) => (
                  <View key={i} style={styles.reasonChip}>
                    <Text style={styles.reasonText}>{r}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.addBtn, sent && styles.addBtnSent]}
              onPress={() => handleAdd(item.userId)}
              disabled={sent}
            >
              <Text style={[styles.addBtnText, sent && styles.addBtnTextSent]}>
                {sent ? '✓ İstek Gönderildi' : '🤝 Arkadaş Ekle'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    list: { padding: 16 },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyIcon: { fontSize: 48, marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, marginBottom: 8 },
    emptyDesc: { fontSize: 14, color: C.textTertiary, textAlign: 'center', lineHeight: 22 },

    card: {
      backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 12,
      shadowColor: C.shadow, shadowOpacity: 0.05, shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatarPlaceholder: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: C.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    avatarIcon: { fontSize: 22 },
    cardInfo: { flex: 1 },
    name: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
    badge: { fontSize: 12, color: C.textTertiary, marginTop: 2 },
    city: { fontSize: 12, color: C.textMuted, marginTop: 2 },
    scoreBlock: { alignItems: 'center' },
    scoreNum: { fontSize: 20, fontWeight: '800', color: C.primary },
    scoreLabel: { fontSize: 10, color: C.textMuted },

    progressBar: {
      height: 6, backgroundColor: C.inputBg, borderRadius: 3,
      marginBottom: 12, overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 3 },

    reasonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
    reasonChip: {
      backgroundColor: C.successSurface, borderRadius: 10,
      paddingHorizontal: 10, paddingVertical: 4,
      borderWidth: 1, borderColor: '#BBF7D0',
    },
    reasonText: { fontSize: 11, color: '#065F46', fontWeight: '600' },

    addBtn: {
      backgroundColor: C.primary, borderRadius: 12,
      paddingVertical: 12, alignItems: 'center',
    },
    addBtnSent: { backgroundColor: C.successSurface },
    addBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    addBtnTextSent: { color: '#065F46' },
  });
}
