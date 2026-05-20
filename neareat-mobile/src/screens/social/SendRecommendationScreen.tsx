import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Image, ActivityIndicator, Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useFriendStore } from '../../store/friendStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { useRecommendationStore } from '../../store/recommendationStore';
import { sendRecommendation, getFriends } from '../../services/social';
import { useRestaurantStore } from '../../store/restaurantStore';
import type { Friend } from '../../types';
import StarRating from '../../components/StarRating';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme';

export default function SendRecommendationScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { placeId, placeName, photoUrl, rating } = route.params as {
    placeId: string; placeName: string; photoUrl: string | null; rating: number;
  };

  const { friends, setFriends } = useFriendStore();
  const { addStarEvent } = useUserProfileStore();
  const { addMyRecommendation } = useRecommendationStore();
  const { C } = useTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);

  const [message, setMessage] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [isPublic, setIsPublic] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const restaurants = useRestaurantStore(s => s.restaurants);
  const restaurant = restaurants.find(r => r.placeId === placeId) ?? {
    placeId, name: placeName, rating: rating ?? 0,
    userRatingsTotal: 0, priceLevel: null, types: [],
    isOpenNow: null, location: { lat: 0, lng: 0 },
    distanceKm: 0, photoUrl,
  };

  useEffect(() => {
    if (friends.length === 0) {
      setLoadingFriends(true);
      getFriends().then(f => { setFriends(f); setLoadingFriends(false); });
    }
  }, []);

  function toggleFriend(id: string) {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (!isPublic && selectedFriends.size === 0) {
      Alert.alert('Alıcı Seç', 'En az bir arkadaş seçin veya herkese açık paylaşın.');
      return;
    }
    setSending(true);
    try {
      const toUserIds = isPublic ? [] : Array.from(selectedFriends);
      const { recommendations, starEvent } = await sendRecommendation(restaurant, toUserIds, message.trim());
      addStarEvent(starEvent);
      recommendations.forEach(r => addMyRecommendation(r));

      Alert.alert(
        'Öneri Gönderildi! +3 ⭐',
        isPublic
          ? 'Profilinde herkese görünür şekilde paylaşıldı.'
          : `${selectedFriends.size} arkadaşına gönderildi.`,
        [{ text: 'Harika!', onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert('Hata', 'Öneri gönderilemedi.');
    } finally {
      setSending(false);
    }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.restaurantCard}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={{ fontSize: 28 }}>🍽️</Text>
          </View>
        )}
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{placeName}</Text>
          <StarRating rating={rating ?? 0} size={13} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Mesaj (isteğe bağlı)</Text>
        <TextInput
          style={styles.messageInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Neden öneriyorsun?"
          placeholderTextColor={C.textMuted}
          multiline
          numberOfLines={3}
          maxLength={200}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Paylaşım Türü</Text>
        <View style={styles.shareTypeRow}>
          <TouchableOpacity
            style={[styles.shareTypeBtn, !isPublic && styles.shareTypeBtnActive]}
            onPress={() => setIsPublic(false)}
          >
            <Text style={[styles.shareTypeText, !isPublic && styles.shareTypeTextActive]}>
              👥 Arkadaşlara Gönder
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shareTypeBtn, isPublic && styles.shareTypeBtnActive]}
            onPress={() => setIsPublic(true)}
          >
            <Text style={[styles.shareTypeText, isPublic && styles.shareTypeTextActive]}>
              🌍 Herkese Açık Paylaş
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {!isPublic && (
        <View style={styles.section}>
          <Text style={styles.label}>Arkadaşlarını Seç</Text>
          {loadingFriends ? (
            <ActivityIndicator color={C.primary} style={{ marginVertical: 12 }} />
          ) : friends.length === 0 ? (
            <Text style={styles.emptyFriends}>
              Henüz arkadaşın yok. Arkadaşlar sekmesinden ekleyebilirsin.
            </Text>
          ) : (
            friends.map(f => (
              <FriendRow
                key={f.id}
                friend={f}
                selected={selectedFriends.has(f.profile.id)}
                onToggle={() => toggleFriend(f.profile.id)}
                C={C}
                styles={styles}
              />
            ))
          )}
        </View>
      )}

      <View style={styles.starHint}>
        <Text style={styles.starHintText}>⭐ Bu öneriyi göndererek +3 yıldız kazanacaksın!</Text>
      </View>

      <TouchableOpacity
        style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={sending}
      >
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.sendBtnText}>
            {isPublic ? '🌍 Profilinde Paylaş' : `📩 ${selectedFriends.size > 0 ? selectedFriends.size + ' Arkadaşa' : 'Arkadaşa'} Gönder`}
          </Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function FriendRow({ friend, selected, onToggle, C, styles }: {
  friend: Friend; selected: boolean; onToggle: () => void; C: Colors; styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <TouchableOpacity style={[styles.friendRow, selected && styles.friendRowSelected]} onPress={onToggle}>
      {friend.profile.photoUrl ? (
        <Image source={{ uri: friend.profile.photoUrl }} style={styles.friendAvatar} />
      ) : (
        <View style={[styles.friendAvatar, styles.friendAvatarPlaceholder]}>
          <Text>{friend.profile.displayName.charAt(0)}</Text>
        </View>
      )}
      <View style={styles.friendRowInfo}>
        <Text style={styles.friendRowName}>{friend.profile.displayName}</Text>
        <Text style={styles.friendRowSub}>{friend.profile.badge}</Text>
      </View>
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected && <Text style={styles.checkmark}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    restaurantCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, padding: 16, marginBottom: 12,
    },
    photo: { width: 64, height: 64, borderRadius: 10, marginRight: 14 },
    photoPlaceholder: { backgroundColor: C.inputBg, alignItems: 'center', justifyContent: 'center' },
    restaurantInfo: { flex: 1 },
    restaurantName: { fontSize: 17, fontWeight: '700', color: C.textPrimary, marginBottom: 4 },
    section: { backgroundColor: C.surface, padding: 16, marginBottom: 10 },
    label: { fontSize: 13, fontWeight: '600', color: C.textSecondary, marginBottom: 10 },
    messageInput: {
      borderWidth: 1, borderColor: C.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
      color: C.textPrimary, backgroundColor: C.background,
      height: 80, textAlignVertical: 'top',
    },
    shareTypeRow: { flexDirection: 'row', gap: 10 },
    shareTypeBtn: {
      flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10,
      paddingVertical: 12, alignItems: 'center', backgroundColor: C.background,
    },
    shareTypeBtnActive: { borderColor: C.primary, backgroundColor: C.primaryLighter },
    shareTypeText: { fontSize: 13, color: C.textTertiary, fontWeight: '500', textAlign: 'center' },
    shareTypeTextActive: { color: C.primary, fontWeight: '700' },
    emptyFriends: { fontSize: 13, color: C.textMuted, textAlign: 'center', paddingVertical: 12 },
    friendRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
      borderBottomWidth: 1, borderColor: C.separator,
    },
    friendRowSelected: { backgroundColor: C.primarySurface, borderRadius: 8, paddingHorizontal: 8 },
    friendAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    friendAvatarPlaceholder: { backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
    friendRowInfo: { flex: 1 },
    friendRowName: { fontSize: 14, fontWeight: '600', color: C.textPrimary },
    friendRowSub: { fontSize: 12, color: C.textMuted },
    checkbox: {
      width: 24, height: 24, borderRadius: 12, borderWidth: 2,
      borderColor: C.border, alignItems: 'center', justifyContent: 'center',
    },
    checkboxSelected: { backgroundColor: C.primary, borderColor: C.primary },
    checkmark: { color: '#fff', fontWeight: '700', fontSize: 14 },
    starHint: {
      backgroundColor: C.warningSurface, margin: 12, borderRadius: 12,
      padding: 14, alignItems: 'center',
    },
    starHintText: { color: '#92400E', fontWeight: '600', fontSize: 14 },
    sendBtn: {
      backgroundColor: C.primary, margin: 16, borderRadius: 14,
      paddingVertical: 16, alignItems: 'center',
    },
    sendBtnDisabled: { opacity: 0.6 },
    sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
}
