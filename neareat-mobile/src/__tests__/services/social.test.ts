/**
 * #430 — social.ts servis katmanı: gerçek backend yolu (MOCK_MODE=false, üretimde
 * her zaman böyle) için endpoint/payload sözleşmesi ve `mapRec` dönüşüm mantığı.
 * MOCK_MODE'lu dallar kasıtlı olarak dışarıda: sadece geliştirme-zamanı sahte veri
 * döndürüyorlar, backend sözleşmesini test etmiyorlar (issue #430 kapsam dışı notu).
 */
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

import api from '../../services/api';
import {
  getLevel,
  getNextMilestone,
  mapRec,
  getMyProfile,
  updateMyProfile,
  getUserProfile,
  searchUsers,
  getActivityFeed,
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  sendRecommendation,
  getMyRecommendations,
  getReceivedRecommendations,
  getFriendRecommendations,
  getStarEvents,
  recordRating,
  getRewards,
  getLeaderboard,
  getFriendSuggestions,
} from '../../services/social';
import type { RawRecommendation, Restaurant } from '../../types';

const mockedApi = api as any;
beforeEach(() => jest.clearAllMocks());

describe('getLevel / getNextMilestone', () => {
  it('levelGate eşiklerini delege eder', () => {
    const lvl = getLevel(0);
    expect(lvl.level).toBe(1);
    expect(typeof lvl.badge).toBe('string');
    expect(typeof lvl.badgeIcon).toBe('string');
  });

  it('en üst seviyede null döner', () => {
    // levelGate zaten test edilmiş; burada sadece delegasyonu doğruluyoruz.
    expect(getNextMilestone(1_000_000)).toBeNull();
  });
});

describe('mapRec', () => {
  const raw: RawRecommendation = {
    id: 'r1',
    fromUserId: 'u1',
    fromProfile: null,
    toUserId: 'u2',
    message: undefined as any,
    createdAt: '2026-01-01',
    placeId: 'p1',
    placeName: 'Lokanta',
    placeRating: undefined as any,
    placeTypes: undefined as any,
    placePhotoUrl: undefined as any,
  } as RawRecommendation;

  it('düz backend kaydını iç içe restaurant nesnesine çevirir', () => {
    const rec = mapRec(raw);
    expect(rec.restaurant).toEqual({
      placeId: 'p1',
      name: 'Lokanta',
      rating: 0,
      userRatingsTotal: 0,
      priceLevel: null,
      types: [],
      isOpenNow: null,
      location: { lat: 0, lng: 0 },
      distanceKm: 0,
      photoUrl: null,
    });
  });

  it('eksik alanları güvenli varsayılanlara düşürür (message, fromProfile)', () => {
    const rec = mapRec(raw);
    expect(rec.message).toBe('');
    expect(rec.fromProfile).toBeNull();
  });

  it('mevcut alanları olduğu gibi korur', () => {
    const rec = mapRec({ ...raw, placeRating: 4.2, placeTypes: ['cafe'], placePhotoUrl: 'x.jpg' });
    expect(rec.restaurant.rating).toBe(4.2);
    expect(rec.restaurant.types).toEqual(['cafe']);
    expect(rec.restaurant.photoUrl).toBe('x.jpg');
  });
});

describe('profil', () => {
  it('getMyProfile /profile/me çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { id: 'u1' } });
    const result = await getMyProfile();
    expect(mockedApi.get).toHaveBeenCalledWith('/profile/me');
    expect(result).toEqual({ id: 'u1' });
  });

  it('updateMyProfile PUT ile alanları gönderir', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: { id: 'u1', displayName: 'Yeni' } });
    const result = await updateMyProfile({ displayName: 'Yeni' });
    expect(mockedApi.put).toHaveBeenCalledWith('/profile/me', { displayName: 'Yeni' });
    expect(result.displayName).toBe('Yeni');
  });

  it('getUserProfile kullanıcı id ile path oluşturur', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { id: 'u2' } });
    await getUserProfile('u2');
    expect(mockedApi.get).toHaveBeenCalledWith('/profile/u2');
  });

  it('searchUsers query string encode eder', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await searchUsers('ali veli');
    expect(mockedApi.get).toHaveBeenCalledWith('/social/users/search?q=ali%20veli');
  });

  it('getActivityFeed limit + cursor query parametrelerini kurar', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { events: [], nextCursor: null } });
    await getActivityFeed('cur1', 10);
    expect(mockedApi.get).toHaveBeenCalledWith('/social/feed?limit=10&cursor=cur1');
  });

  it('getActivityFeed cursor verilmezse limit-only query kurar', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { events: [], nextCursor: null } });
    await getActivityFeed();
    expect(mockedApi.get).toHaveBeenCalledWith('/social/feed?limit=20');
  });
});

describe('arkadaşlık', () => {
  it('getFriends /social/friends çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await getFriends();
    expect(mockedApi.get).toHaveBeenCalledWith('/social/friends');
  });

  it('getPendingRequests /social/friends/requests çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await getPendingRequests();
    expect(mockedApi.get).toHaveBeenCalledWith('/social/friends/requests');
  });

  it('sendFriendRequest note verilmezse undefined gönderir', async () => {
    mockedApi.post.mockResolvedValueOnce({});
    await sendFriendRequest('u2');
    expect(mockedApi.post).toHaveBeenCalledWith('/social/friends/requests', { toUserId: 'u2', note: undefined });
  });

  it('acceptFriendRequest doğru path ile POST atar ve backend sonucunu döner', async () => {
    const payload = { friend: {}, starEvent: {}, newStarCount: 5, newRewards: [] };
    mockedApi.post.mockResolvedValueOnce({ data: payload });
    const result = await acceptFriendRequest('req1', {} as any);
    expect(mockedApi.post).toHaveBeenCalledWith('/social/friends/requests/req1/accept');
    expect(result).toEqual(payload);
  });

  it('rejectFriendRequest doğru path ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({});
    await rejectFriendRequest('req1');
    expect(mockedApi.post).toHaveBeenCalledWith('/social/friends/requests/req1/reject');
  });

  it('removeFriend doğru path ile DELETE atar', async () => {
    mockedApi.delete.mockResolvedValueOnce({});
    await removeFriend('f1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/social/friends/f1');
  });
});

describe('restoran önerileri', () => {
  const restaurant: Restaurant = {
    placeId: 'p1', name: 'Lokanta', rating: 4.5, userRatingsTotal: 10, priceLevel: 2,
    types: ['cafe'], isOpenNow: true, location: { lat: 1, lng: 2 }, distanceKm: 0.3, photoUrl: 'x.jpg',
  } as Restaurant;

  it('sendRecommendation restoranı backend düz şemasına çevirip gönderir', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { recommendations: [], starEvent: {}, newStarCount: 1, newRewards: [] } });
    await sendRecommendation(restaurant, ['u2', 'u3'], 'Dene bunu');
    expect(mockedApi.post).toHaveBeenCalledWith('/social/recommendations', {
      placeId: 'p1', placeName: 'Lokanta', placeAddress: null, placePhotoUrl: 'x.jpg',
      placeRating: 4.5, placeTypes: ['cafe'], toUserIds: ['u2', 'u3'], message: 'Dene bunu',
    });
  });

  it('getMyRecommendations backend yanıtını mapRec ile dönüştürür', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ id: 'r1', fromUserId: 'u1', toUserId: null, createdAt: 't', placeId: 'p1', placeName: 'X' }] });
    const result = await getMyRecommendations();
    expect(mockedApi.get).toHaveBeenCalledWith('/social/recommendations/mine');
    expect(result[0].restaurant.placeId).toBe('p1');
  });

  it('getReceivedRecommendations backend yanıtını mapRec ile dönüştürür', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ id: 'r1', fromUserId: 'u1', toUserId: 'u2', createdAt: 't', placeId: 'p1', placeName: 'X' }] });
    const result = await getReceivedRecommendations();
    expect(mockedApi.get).toHaveBeenCalledWith('/social/recommendations/received');
    expect(result[0].id).toBe('r1');
  });

  it('getFriendRecommendations kullanıcı id ile path kurar', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await getFriendRecommendations('u2');
    expect(mockedApi.get).toHaveBeenCalledWith('/social/recommendations/user/u2');
  });

  it('getStarEvents /social/stars çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await getStarEvents();
    expect(mockedApi.get).toHaveBeenCalledWith('/social/stars');
  });
});

describe('yıldız ve ödüller', () => {
  it('recordRating placeId/placeName ile POST atar', async () => {
    const payload = { starEvent: {}, newStarCount: 2, newRewards: [] };
    mockedApi.post.mockResolvedValueOnce({ data: payload });
    const result = await recordRating('p1', 'Lokanta');
    expect(mockedApi.post).toHaveBeenCalledWith('/social/stars/rating', { placeId: 'p1', placeName: 'Lokanta' });
    expect(result).toEqual(payload);
  });

  it('getRewards /social/rewards çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] });
    await getRewards(10);
    expect(mockedApi.get).toHaveBeenCalledWith('/social/rewards');
  });

  it('getLeaderboard /social/leaderboard çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { entries: [] } });
    await getLeaderboard();
    expect(mockedApi.get).toHaveBeenCalledWith('/social/leaderboard');
  });

  it('getFriendSuggestions suggestions alanını çıkarır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { suggestions: [{ userId: 'u3' }] } });
    const result = await getFriendSuggestions();
    expect(mockedApi.get).toHaveBeenCalledWith('/social/friend-suggestions');
    expect(result).toEqual([{ userId: 'u3' }]);
  });
});
