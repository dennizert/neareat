import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useUserProfileStore } from '../../store/userProfileStore';
import { getRewards, getStarEvents, getNextMilestone, getLeaderboard } from '../../services/social';
import type { Reward, StarEvent, Leaderboard } from '../../types';

const STAR_EVENT_LABELS: Record<string, string> = {
  review: '✍️ Yorum',
  recommendation: '📤 Öneri',
  friend_added: '🤝 Arkadaş',
  rating: '⭐ Puanlama',
};

export default function RewardsScreen() {
  const { profile, starEvents, setProfile } = useUserProfileStore();
  const [rewards, setRewards] = useState<(Reward & { isUnlocked: boolean })[]>([]);
  const [events, setEvents] = useState<StarEvent[]>([]);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [loading, setLoading] = useState(true);

  const starCount = profile?.starCount ?? 0;
  const nextMilestone = getNextMilestone(starCount);
  const progress = starCount >= 100 ? 1 : (starCount % nextMilestone) / nextMilestone;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [r, e, lb] = await Promise.all([getRewards(starCount), getStarEvents(), getLeaderboard()]);
        setRewards(r);
        setEvents(e);
        setLeaderboard(lb);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [starCount]);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#FF6B35" />;
  }

  const starsToNext = nextMilestone - starCount;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Text style={styles.heroIcon}>{profile?.badgeIcon ?? '🌱'}</Text>
        <Text style={styles.heroLevel}>Seviye {profile?.level}</Text>
        <Text style={styles.heroBadge}>{profile?.badge}</Text>
        <View style={styles.starCountRow}>
          <Text style={styles.starCountNum}>{starCount}</Text>
          <Text style={styles.starCountLabel}> Yıldız</Text>
        </View>

        {starCount < 100 && (
          <>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
            </View>
            <Text style={styles.progressText}>
              Bir sonraki seviye için {starsToNext} yıldız daha gerekiyor
            </Text>
          </>
        )}
      </View>

      <View style={styles.earnSection}>
        <Text style={styles.sectionTitle}>Nasıl Yıldız Kazanırsın?</Text>
        {[
          { icon: '✍️', label: 'Restoran Yorumu', amount: 5 },
          { icon: '📤', label: 'Restoran Önerisi', amount: 3 },
          { icon: '⭐', label: 'Hızlı Puanlama', amount: 2 },
          { icon: '🤝', label: 'Arkadaş Ekle', amount: 1 },
        ].map(item => (
          <View key={item.label} style={styles.earnRow}>
            <Text style={styles.earnIcon}>{item.icon}</Text>
            <Text style={styles.earnLabel}>{item.label}</Text>
            <View style={styles.earnBadge}>
              <Text style={styles.earnAmount}>+{item.amount} ⭐</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.rewardsSection}>
        <Text style={styles.sectionTitle}>Ödüller & Rozetler</Text>
        {rewards.map(r => (
          <View key={r.id} style={[styles.rewardCard, !r.isUnlocked && styles.rewardCardLocked]}>
            <Text style={[styles.rewardIcon, !r.isUnlocked && styles.rewardIconLocked]}>
              {r.isUnlocked ? r.icon : '🔒'}
            </Text>
            <View style={styles.rewardInfo}>
              <View style={styles.rewardTitleRow}>
                <Text style={[styles.rewardName, !r.isUnlocked && styles.rewardNameLocked]}>
                  {r.name}
                </Text>
                {r.type === 'gift' && r.isUnlocked && (
                  <View style={styles.giftBadge}>
                    <Text style={styles.giftBadgeText}>HEDİYE</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.rewardDesc, !r.isUnlocked && styles.rewardDescLocked]}>
                {r.description}
              </Text>
              {!r.isUnlocked && (
                <Text style={styles.rewardRequired}>{r.requiredStars} yıldız gerekli</Text>
              )}
            </View>
            {r.isUnlocked && (
              <View style={styles.unlockedBadge}>
                <Text style={styles.unlockedText}>✓</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {leaderboard && (
        <View style={styles.leaderboardSection}>
          <Text style={styles.sectionTitle}>🏆 Liderlik Tablosu</Text>
          {leaderboard.top5.map((entry) => (
            <View
              key={entry.rank}
              style={[styles.leaderRow, entry.isMe && styles.leaderRowMe]}
            >
              <Text style={styles.leaderMedal}>{entry.medal}</Text>
              <View style={styles.leaderInfo}>
                <Text style={[styles.leaderName, entry.isMe && styles.leaderNameMe]}>
                  {entry.maskedName}
                  {entry.isMe && <Text style={styles.leaderMeLabel}> (Sen)</Text>}
                </Text>
                <Text style={styles.leaderBadge}>{entry.badgeIcon} {entry.badge}</Text>
              </View>
              <View style={styles.leaderStars}>
                <Text style={[styles.leaderStarNum, entry.isMe && styles.leaderStarNumMe]}>{entry.starCount}</Text>
                <Text style={styles.leaderStarLabel}> ⭐</Text>
              </View>
            </View>
          ))}
          {!leaderboard.top5.some(e => e.isMe) && (
            <View style={styles.myRankRow}>
              <Text style={styles.myRankText}>
                Senin sıran: <Text style={styles.myRankNum}>#{leaderboard.myRank}</Text>
                {' · '}{leaderboard.myStarCount} ⭐
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Yıldız Geçmişi</Text>
        {events.length === 0 ? (
          <Text style={styles.emptyText}>Henüz yıldız kazanmadın. Yorum yap, öneri gönder!</Text>
        ) : (
          events.slice(0, 20).map(e => (
            <View key={e.id} style={styles.eventRow}>
              <Text style={styles.eventIcon}>{STAR_EVENT_LABELS[e.type] ?? '⭐'}</Text>
              <View style={styles.eventInfo}>
                <Text style={styles.eventDesc}>{e.description}</Text>
                <Text style={styles.eventDate}>{timeAgo(e.createdAt)}</Text>
              </View>
              <Text style={styles.eventAmount}>+{e.amount} ⭐</Text>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Bugün';
  if (days === 1) return 'Dün';
  if (days < 7) return `${days} gün önce`;
  return `${Math.floor(days / 7)} hafta önce`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  heroCard: {
    backgroundColor: '#FF6B35', padding: 28, alignItems: 'center',
  },
  heroIcon: { fontSize: 48, marginBottom: 8 },
  heroLevel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  heroBadge: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 12 },
  starCountRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 16 },
  starCountNum: { fontSize: 48, fontWeight: '800', color: '#fff' },
  starCountLabel: { fontSize: 18, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  progressBar: {
    width: '80%', height: 8, backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4, marginBottom: 8, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  progressText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  earnSection: { backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  earnRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F3F4F6',
  },
  earnIcon: { fontSize: 20, width: 32 },
  earnLabel: { flex: 1, fontSize: 14, color: '#374151' },
  earnBadge: { backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  earnAmount: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  rewardsSection: { backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16 },
  rewardCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F3F4F6', gap: 12,
  },
  rewardCardLocked: { opacity: 0.5 },
  rewardIcon: { fontSize: 32, width: 44, textAlign: 'center' },
  rewardIconLocked: {},
  rewardInfo: { flex: 1 },
  rewardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rewardName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rewardNameLocked: { color: '#9CA3AF' },
  rewardDesc: { fontSize: 12, color: '#6B7280', marginTop: 3, lineHeight: 18 },
  rewardDescLocked: { color: '#D1D5DB' },
  rewardRequired: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  giftBadge: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  giftBadgeText: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  unlockedBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center',
  },
  unlockedText: { color: '#065F46', fontWeight: '700', fontSize: 14 },
  leaderboardSection: { backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16 },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F3F4F6', gap: 10,
  },
  leaderRowMe: { backgroundColor: '#FFF7ED', borderRadius: 10, paddingHorizontal: 8 },
  leaderMedal: { fontSize: 22, width: 32, textAlign: 'center' },
  leaderInfo: { flex: 1 },
  leaderName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  leaderNameMe: { color: '#FF6B35' },
  leaderMeLabel: { fontSize: 12, fontWeight: '500', color: '#FF6B35' },
  leaderBadge: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  leaderStars: { flexDirection: 'row', alignItems: 'baseline' },
  leaderStarNum: { fontSize: 16, fontWeight: '800', color: '#374151' },
  leaderStarNumMe: { color: '#FF6B35' },
  leaderStarLabel: { fontSize: 13, color: '#6B7280' },
  myRankRow: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderColor: '#F3F4F6', alignItems: 'center',
  },
  myRankText: { fontSize: 13, color: '#6B7280' },
  myRankNum: { fontWeight: '800', color: '#FF6B35', fontSize: 15 },
  historySection: { backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16 },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 },
  eventRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F3F4F6', gap: 10,
  },
  eventIcon: { fontSize: 20, width: 32 },
  eventInfo: { flex: 1 },
  eventDesc: { fontSize: 13, color: '#374151' },
  eventDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  eventAmount: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
});
