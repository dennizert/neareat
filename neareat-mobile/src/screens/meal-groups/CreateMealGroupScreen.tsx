import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import type { Friend } from '../../types';
import { getFriends } from '../../services/social';
import { createMealGroup } from '../../services/mealGroups';
import { useAuthStore } from '../../store/authStore';

export default function CreateMealGroupScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const loadFriends = useCallback(async () => {
    try {
      const data = await getFriends();
      setFriends(data);
    } catch {
      // silent
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  React.useEffect(() => { loadFriends(); }, [loadFriends]);

  function toggleFriend(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) { next.delete(userId); } else { next.add(userId); }
      return next;
    });
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Hata', 'Grup adı zorunludur.');
      return;
    }
    setCreating(true);
    try {
      const group = await createMealGroup({ name: trimmed, memberIds: [...selectedIds] });
      navigation.replace('MealGroupDetail', { groupId: group.id, groupName: group.name });
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'Grup oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  }

  const filtered = friends.filter((f) =>
    f.profile.displayName.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.form}>
        <Text style={styles.label}>Grup Adı</Text>
        <TextInput
          style={styles.nameInput}
          placeholder="örn: Cuma Yemeği, İş Arkadaşları..."
          placeholderTextColor={C.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoFocus
        />

        <Text style={styles.label}>Arkadaşları Davet Et</Text>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="İsme göre ara..."
            placeholderTextColor={C.textMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {loadingFriends ? (
        <ActivityIndicator size="small" color={C.primary} style={{ marginTop: 20 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {friends.length === 0
              ? 'Henüz arkadaşın yok. Önce arkadaş ekle.'
              : 'Sonuç bulunamadı.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(f) => f.userId}
          renderItem={({ item }) => {
            const selected = selectedIds.has(item.userId);
            return (
              <TouchableOpacity
                style={[styles.friendRow, selected && styles.friendRowSelected]}
                onPress={() => toggleFriend(item.userId)}
              >
                {item.profile.photoUrl ? (
                  <Image source={{ uri: item.profile.photoUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarLetter}>{item.profile.displayName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{item.profile.displayName}</Text>
                  {item.profile.city ? <Text style={styles.friendCity}>{item.profile.city}</Text> : null}
                </View>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.list}
        />
      )}

      <View style={styles.footer}>
        {selectedIds.size > 0 && (
          <Text style={styles.selectedCount}>{selectedIds.size} arkadaş seçildi</Text>
        )}
        <TouchableOpacity
          style={[styles.createBtn, (!name.trim() || creating) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!name.trim() || creating}
        >
          {creating
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.createBtnText}>Grubu Oluştur</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },

    form: { padding: 16, paddingBottom: 0 },
    label: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: 6, marginTop: 14 },
    nameInput: {
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.textPrimary,
    },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, marginBottom: 4,
    },
    searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: C.textPrimary },

    list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

    friendRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
      borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border,
    },
    friendRowSelected: { borderColor: C.primary, backgroundColor: C.primaryLight },

    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarLetter: { fontSize: 18, fontWeight: '700', color: '#fff' },

    friendInfo: { flex: 1, marginLeft: 12 },
    friendName: { fontSize: 15, fontWeight: '600', color: C.textPrimary },
    friendCity: { fontSize: 12, color: C.textMuted, marginTop: 2 },

    checkbox: {
      width: 26, height: 26, borderRadius: 13, borderWidth: 2,
      borderColor: C.border, alignItems: 'center', justifyContent: 'center',
    },
    checkboxSelected: { backgroundColor: C.primary, borderColor: C.primary },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },

    footer: { padding: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
    selectedCount: { fontSize: 13, color: C.textSecondary, marginBottom: 10, textAlign: 'center' },
    createBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    createBtnDisabled: { opacity: 0.5 },
    createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
}
