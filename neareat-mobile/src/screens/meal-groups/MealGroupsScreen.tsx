import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';
import type { MealGroup } from '../../types';
import { getMyMealGroups, respondToMealGroupInvite } from '../../services/mealGroups';

function MemberAvatars({ members, C, styles }: { members: MealGroup['members']; C: Colors; styles: ReturnType<typeof makeStyles> }) {
  const accepted = members.filter((m) => m.status === 'ACCEPTED');
  const shown = accepted.slice(0, 4);
  const extra = accepted.length - 4;

  return (
    <View style={styles.avatarRow}>
      {shown.map((m, i) => (
        <View key={m.userId} style={[styles.avatarCircle, { marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }]}>
          <Text style={styles.avatarLetter}>{m.user.displayName.charAt(0).toUpperCase()}</Text>
        </View>
      ))}
      {extra > 0 && (
        <View style={[styles.avatarCircle, styles.avatarExtra, { marginLeft: -8 }]}>
          <Text style={styles.avatarExtraText}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

export default function MealGroupsScreen() {
  const navigation = useNavigation<any>();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [groups, setGroups] = useState<MealGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getMyMealGroups();
      setGroups(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRespond(group: MealGroup, status: 'ACCEPTED' | 'DECLINED') {
    try {
      await respondToMealGroupInvite(group.id, status);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === group.id
            ? { ...g, myStatus: status, members: g.members.map((m) => m.userId === group.members.find((x) => x.status === 'INVITED' && x.userId === group.creatorId)?.userId ? m : m) }
            : g,
        ),
      );
      load();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.error || 'İşlem başarısız.');
    }
  }

  function renderItem({ item }: { item: MealGroup }) {
    const isInvited = item.myStatus === 'INVITED';
    const acceptedCount = item.members.filter((m) => m.status === 'ACCEPTED').length;
    const invitedCount = item.members.filter((m) => m.status === 'INVITED').length;

    return (
      <TouchableOpacity
        style={[styles.card, isInvited && styles.cardInvited]}
        onPress={() => !isInvited && navigation.navigate('MealGroupDetail', { groupId: item.id, groupName: item.name })}
        activeOpacity={isInvited ? 1 : 0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            {isInvited && (
              <View style={styles.inviteBadge}>
                <Text style={styles.inviteBadgeText}>Davet</Text>
              </View>
            )}
          </View>
          {item.hasOpenPoll && !isInvited && (
            <View style={styles.pollBadge}>
              <Text style={styles.pollBadgeText}>Anket açık</Text>
            </View>
          )}
        </View>

        <View style={styles.cardMeta}>
          <MemberAvatars members={item.members} C={C} styles={styles} />
          <Text style={styles.memberCount}>
            {acceptedCount} üye{invitedCount > 0 ? ` • ${invitedCount} bekliyor` : ''}
          </Text>
        </View>

        {isInvited ? (
          <View style={styles.inviteActions}>
            <Text style={styles.inviteText}>
              {item.creator.displayName} seni bu gruba davet etti
            </Text>
            <View style={styles.inviteBtns}>
              <TouchableOpacity
                style={[styles.inviteBtn, styles.inviteBtnAccept]}
                onPress={() => handleRespond(item, 'ACCEPTED')}
              >
                <Text style={styles.inviteBtnAcceptText}>Kabul Et</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inviteBtn, styles.inviteBtnDecline]}
                onPress={() => handleRespond(item, 'DECLINED')}
              >
                <Text style={styles.inviteBtnDeclineText}>Reddet</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.cardFooter}>
            <Text style={styles.cardDate}>
              {new Date(item.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
        contentContainerStyle={groups.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>Henüz grup yok</Text>
            <Text style={styles.emptyText}>Arkadaşlarınla bir yemek grubu oluştur ve nereye gideceğinize birlikte karar verin.</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('CreateMealGroup')}
            >
              <Text style={styles.emptyBtnText}>İlk Grubu Oluştur</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {groups.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateMealGroup')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },
    listContent: { padding: 16, paddingBottom: 100 },
    emptyContainer: { flex: 1 },

    card: {
      backgroundColor: C.surface, borderRadius: 14, padding: 16,
      marginBottom: 12, borderWidth: 1, borderColor: C.border,
    },
    cardInvited: { borderColor: C.primary, borderWidth: 1.5 },

    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary, flex: 1 },

    inviteBadge: { backgroundColor: C.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    inviteBadgeText: { fontSize: 11, fontWeight: '700', color: C.primary },
    pollBadge: { backgroundColor: C.warningSurface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    pollBadgeText: { fontSize: 11, fontWeight: '600', color: C.warning },

    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    avatarRow: { flexDirection: 'row', alignItems: 'center' },
    avatarCircle: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: C.surface,
    },
    avatarLetter: { fontSize: 12, fontWeight: '700', color: '#fff' },
    avatarExtra: { backgroundColor: C.textMuted },
    avatarExtraText: { fontSize: 10, fontWeight: '700', color: '#fff' },
    memberCount: { fontSize: 13, color: C.textSecondary },

    inviteActions: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
    inviteText: { fontSize: 13, color: C.textSecondary, marginBottom: 10 },
    inviteBtns: { flexDirection: 'row', gap: 10 },
    inviteBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
    inviteBtnAccept: { backgroundColor: C.primary },
    inviteBtnDecline: { backgroundColor: C.background, borderWidth: 1, borderColor: C.border },
    inviteBtnAcceptText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    inviteBtnDeclineText: { color: C.textSecondary, fontWeight: '600', fontSize: 14 },

    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardDate: { fontSize: 12, color: C.textMuted },

    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 100 },
    emptyIcon: { fontSize: 52, marginBottom: 16 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: C.textPrimary, marginBottom: 10, textAlign: 'center' },
    emptyText: { fontSize: 14, color: C.textTertiary, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
    emptyBtn: { backgroundColor: C.primary, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12 },
    emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    fab: {
      position: 'absolute', bottom: 24, right: 24,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6,
      elevation: 6,
    },
  });
}
