import { MOCK_MODE } from '../config';
import {
  MOCK_USER_PROFILES,
  MOCK_FRIENDS,
  MOCK_FRIEND_REQUESTS,
  MOCK_RECOMMENDATIONS,
  MOCK_STAR_EVENTS,
  MOCK_REWARDS,
} from '../mocks/data';
import type { UserProfile, Friend, FriendRequest, Recommendation, StarEvent, Reward, Restaurant, Leaderboard, FriendSuggestion, ActivityFeedResponse } from '../types';
import api from './api';

let sessionProfile = { ...MOCK_USER_PROFILES[0] };
let sessionFriends = [...MOCK_FRIENDS];
let sessionRequests = [...MOCK_FRIEND_REQUESTS];
let sessionRecommendations = [...MOCK_RECOMMENDATIONS];
let sessionStarEvents = [...MOCK_STAR_EVENTS];

export const STAR_AMOUNTS: Record<StarEvent['type'], number> = {
  review: 5,
  recommendation: 3,
  friend_added: 1,
  rating: 2,
};

export function getLevel(stars: number): { level: number; badge: string; badgeIcon: string } {
  if (stars >= 100) return { level: 5, badge: 'Gastronomi Efsanesi', badgeIcon: '👑' };
  if (stars >= 50) return { level: 4, badge: 'Eatlas Elçisi', badgeIcon: '⭐' };
  if (stars >= 25) return { level: 3, badge: 'Restoran Uzmanı', badgeIcon: '🏆' };
  if (stars >= 10) return { level: 2, badge: 'Gastronomi Meraklısı', badgeIcon: '🍽️' };
  return { level: 1, badge: 'Yeni Kaşif', badgeIcon: '🌱' };
}

export function getNextMilestone(stars: number): number {
  if (stars < 10) return 10;
  if (stars < 25) return 25;
  if (stars < 50) return 50;
  if (stars < 100) return 100;
  return 100;
}

export async function getMyProfile(): Promise<UserProfile> {
  if (MOCK_MODE) return { ...sessionProfile };
  const res = await api.get('/profile/me');
  return res.data;
}

export async function updateMyProfile(fields: Partial<UserProfile>): Promise<UserProfile> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 400));
    sessionProfile = { ...sessionProfile, ...fields };
    return { ...sessionProfile };
  }
  const res = await api.put('/profile/me', fields);
  return res.data;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (MOCK_MODE) {
    const p = MOCK_USER_PROFILES.find(p => p.id === userId);
    return p ? { ...p } : null;
  }
  const res = await api.get(`/profile/${userId}`);
  return res.data;
}

export async function searchUsers(query: string): Promise<UserProfile[]> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 300));
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const friendIds = new Set(sessionFriends.map(f => f.profile.id));
    return MOCK_USER_PROFILES.filter(
      p => p.id !== 'mock-user-001' &&
        !friendIds.has(p.id) &&
        p.displayName.toLowerCase().includes(q),
    );
  }
  const res = await api.get(`/social/users/search?q=${encodeURIComponent(query)}`);
  return res.data;
}

export async function getActivityFeed(
  cursor?: string | null,
  limit = 20,
): Promise<ActivityFeedResponse> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 200));
    return { events: [], nextCursor: null };
  }
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  const res = await api.get(`/social/feed?${params.toString()}`);
  return res.data;
}

export async function getFriends(): Promise<Friend[]> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 200));
    return [...sessionFriends];
  }
  const res = await api.get('/social/friends');
  return res.data;
}

export async function getPendingRequests(): Promise<FriendRequest[]> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 200));
    return sessionRequests.filter(r => r.status === 'pending');
  }
  const res = await api.get('/social/friends/requests');
  return res.data;
}

export async function sendFriendRequest(userId: string, note?: string): Promise<void> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 400));
    return;
  }
  await api.post('/social/friends/requests', { toUserId: userId, note: note || undefined });
}

export interface AcceptFriendResult {
  friend: Friend;
  starEvent: StarEvent;
  newStarCount: number;
  newRewards: Reward[];
}

export async function acceptFriendRequest(requestId: string, fromProfile: UserProfile): Promise<AcceptFriendResult> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 400));
    sessionRequests = sessionRequests.filter(r => r.id !== requestId);
    const friend: Friend = {
      id: `friend-${Date.now()}`,
      userId: 'mock-user-001',
      profile: fromProfile,
      createdAt: new Date().toISOString(),
    };
    sessionFriends = [friend, ...sessionFriends];
    const starEvent: StarEvent = {
      id: `se-${Date.now()}`,
      type: 'friend_added',
      amount: STAR_AMOUNTS.friend_added,
      description: `${fromProfile.displayName} ile arkadaş oldun`,
      createdAt: new Date().toISOString(),
    };
    sessionStarEvents = [starEvent, ...sessionStarEvents];
    sessionProfile.starCount += starEvent.amount;
    return { friend, starEvent, newStarCount: sessionProfile.starCount, newRewards: [] };
  }
  const res = await api.post(`/social/friends/requests/${requestId}/accept`);
  return res.data;
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 200));
    sessionRequests = sessionRequests.filter(r => r.id !== requestId);
    return;
  }
  await api.post(`/social/friends/requests/${requestId}/reject`);
}

export async function removeFriend(friendId: string): Promise<void> {
  if (MOCK_MODE) {
    sessionFriends = sessionFriends.filter(f => f.id !== friendId);
    return;
  }
  await api.delete(`/social/friends/${friendId}`);
}

export interface SendRecommendationResult {
  recommendations: Recommendation[];
  starEvent: StarEvent;
  newStarCount: number;
  newRewards: Reward[];
}

export async function sendRecommendation(
  restaurant: Restaurant,
  toUserIds: string[],
  message: string,
): Promise<SendRecommendationResult> {
  if (MOCK_MODE) {
    await new Promise(r => setTimeout(r, 400));
    const created: Recommendation[] = [];
    if (toUserIds.length === 0) {
      const rec: Recommendation = {
        id: `rec-${Date.now()}`,
        fromUserId: 'mock-user-001',
        fromProfile: sessionProfile,
        toUserId: null,
        restaurant,
        message,
        createdAt: new Date().toISOString(),
      };
      sessionRecommendations = [rec, ...sessionRecommendations];
      created.push(rec);
    } else {
      for (const userId of toUserIds) {
        const rec: Recommendation = {
          id: `rec-${Date.now()}-${userId}`,
          fromUserId: 'mock-user-001',
          fromProfile: sessionProfile,
          toUserId: userId,
          restaurant,
          message,
          createdAt: new Date().toISOString(),
        };
        sessionRecommendations = [rec, ...sessionRecommendations];
        created.push(rec);
      }
    }
    const starEvent: StarEvent = {
      id: `se-${Date.now()}`,
      type: 'recommendation',
      amount: STAR_AMOUNTS.recommendation,
      description: `${restaurant.name}'ı paylaştın`,
      createdAt: new Date().toISOString(),
    };
    sessionStarEvents = [starEvent, ...sessionStarEvents];
    sessionProfile.starCount += starEvent.amount;
    return { recommendations: created, starEvent, newStarCount: sessionProfile.starCount, newRewards: [] };
  }
  const res = await api.post('/social/recommendations', {
    placeId: restaurant.placeId,
    placeName: restaurant.name,
    placeAddress: null,
    placePhotoUrl: restaurant.photoUrl ?? null,
    placeRating: restaurant.rating,
    placeTypes: restaurant.types ?? [],
    toUserIds,
    message,
  });
  return res.data;
}

function mapRec(r: any): Recommendation {
  return {
    id: r.id,
    fromUserId: r.fromUserId,
    fromProfile: r.fromProfile ?? null,
    toUserId: r.toUserId,
    message: r.message ?? '',
    createdAt: r.createdAt,
    restaurant: {
      placeId: r.placeId,
      name: r.placeName,
      rating: r.placeRating ?? 0,
      userRatingsTotal: 0,
      priceLevel: null,
      types: r.placeTypes ?? [],
      isOpenNow: null,
      location: { lat: 0, lng: 0 },
      distanceKm: 0,
      photoUrl: r.placePhotoUrl ?? null,
    },
  };
}

export async function getMyRecommendations(): Promise<Recommendation[]> {
  if (MOCK_MODE) {
    return sessionRecommendations.filter(r => r.fromUserId === 'mock-user-001');
  }
  const res = await api.get('/social/recommendations/mine');
  return res.data.map(mapRec);
}

export async function getReceivedRecommendations(): Promise<Recommendation[]> {
  if (MOCK_MODE) {
    return sessionRecommendations.filter(r => r.toUserId === 'mock-user-001');
  }
  const res = await api.get('/social/recommendations/received');
  return res.data.map(mapRec);
}

export async function getFriendRecommendations(userId: string): Promise<Recommendation[]> {
  if (MOCK_MODE) {
    return sessionRecommendations.filter(
      r => r.fromUserId === userId && r.toUserId === null,
    );
  }
  const res = await api.get(`/social/recommendations/user/${userId}`);
  return res.data.map(mapRec);
}

export async function getStarEvents(): Promise<StarEvent[]> {
  if (MOCK_MODE) {
    return [...sessionStarEvents];
  }
  const res = await api.get('/social/stars');
  return res.data;
}

export interface RatingResult {
  starEvent: StarEvent;
  newStarCount: number;
  newRewards: Reward[];
}

export async function recordRating(placeId: string, placeName: string): Promise<RatingResult> {
  const amount = STAR_AMOUNTS.rating;
  if (MOCK_MODE) {
    const starEvent: StarEvent = {
      id: `se-${Date.now()}`,
      type: 'rating',
      amount,
      description: `${placeName}'ı puanladın`,
      createdAt: new Date().toISOString(),
    };
    sessionStarEvents = [starEvent, ...sessionStarEvents];
    sessionProfile.starCount += amount;
    return { starEvent, newStarCount: sessionProfile.starCount, newRewards: [] };
  }
  const res = await api.post('/social/stars/rating', { placeId, placeName });
  return res.data;
}

export async function getRewards(starCount: number): Promise<(Reward & { isUnlocked: boolean })[]> {
  if (MOCK_MODE) {
    return MOCK_REWARDS.map(r => ({ ...r, isUnlocked: starCount >= r.requiredStars }));
  }
  const res = await api.get('/social/rewards');
  return res.data;
}

export async function getLeaderboard(): Promise<Leaderboard> {
  const res = await api.get('/social/leaderboard');
  return res.data;
}

export async function getFriendSuggestions(): Promise<FriendSuggestion[]> {
  const res = await api.get('/social/friend-suggestions');
  return res.data.suggestions;
}
