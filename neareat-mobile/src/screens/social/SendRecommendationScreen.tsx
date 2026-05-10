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

export default function SendRecommendationScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { placeId, placeName, photoUrl, rating } = route.params as {
    placeId: string; placeName: string; photoUrl: string | null; rating: number;
  };

  const { friends, setFriends } = useFriendStore();
  const { addStarEvent } = useUserProfileStore();
  const { addMyRecommendation } = useRecommendationStore();

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
          placeholderTextColor="#9CA3AF"
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
            <ActivityIndicator color="#FF6B35" style={{ marginVertical: 12 }} />
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

function FriendRow({ friend, selected, onToggle }: {
  friend: Friend; selected: boolean; onToggle: () => void;
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  restaurantCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', padding: 16, marginBottom: 12,
  },
  photo: { width: 64, height: 64, borderRadius: 10, marginRight: 14 },
  photoPlaceholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  restaurantInfo: { flex: 1 },
  restaurantName: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 4 },
  section: { backgroundColor: '#fff', padding: 16, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 },
  messageInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    color: '#111827', backgroundColor: '#FAFAFA',
    height: 80, textAlignVertical: 'top',
  },
  shareTypeRow: { flexDirection: 'row', gap: 10 },
  shareTypeBtn: {
    flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', backgroundColor: '#FAFAFA',
  },
  shareTypeBtnActive: { borderColor: '#FF6B35', backgroundColor: '#FFF0EB' },
  shareTypeText: { fontSize: 13, color: '#6B7280', fontWeight: '500', textAlign: 'center' },
  shareTypeTextActive: { color: '#FF6B35', fontWeight: '700' },
  emptyFriends: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12 },
  friendRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderColor: '#F3F4F6',
  },
  friendRowSelected: { backgroundColor: '#FFF7F4', borderRadius: 8, paddingHorizontal: 8 },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  friendAvatarPlaceholder: { backgroundColor: '#FFE8DF', alignItems: 'center', justifyContent: 'center' },
  friendRowInfo: { flex: 1 },
  friendRowName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  friendRowSub: { fontSize: 12, color: '#9CA3AF' },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  checkmark: { color: '#fff', fontWeight: '700', fontSize: 14 },
  starHint: {
    backgroundColor: '#FFFBEB', margin: 12, borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  starHintText: { color: '#92400E', fontWeight: '600', fontSize: 14 },
  sendBtn: {
    backgroundColor: '#FF6B35', margin: 16, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
