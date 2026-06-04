import { notificationTarget } from '../../utils/notificationTarget';

// NOTIF-1 — bildirim deep-link eşleyici (saf fonksiyon)

describe('notificationTarget', () => {
  it('RESERVATION_* → ReservationDetail (reservationId)', () => {
    for (const t of ['RESERVATION_CONFIRMED', 'RESERVATION_REJECTED', 'RESERVATION_CANCELLED', 'RESERVATION_MESSAGE', 'RESERVATION_REQUEST']) {
      expect(notificationTarget(t, { reservationId: 'r1' }))
        .toEqual({ screen: 'ReservationDetail', params: { reservationId: 'r1' } });
    }
  });

  it('mekan tipleri → RestaurantDetail (placeId)', () => {
    for (const t of ['INSTANT_DISCOUNT', 'REVIEW_REPLY', 'FAVORITE_ANNOUNCEMENT', 'FAVORITE_CLOSING_SOON', 'RECOMMENDATION']) {
      expect(notificationTarget(t, { placeId: 'p1' }))
        .toEqual({ screen: 'RestaurantDetail', params: { placeId: 'p1' } });
    }
  });

  it('MEAL_GROUP_* ve POLL_VOTE_REMINDER → MealGroupDetail (groupId)', () => {
    expect(notificationTarget('MEAL_GROUP_INVITE', { groupId: 'g1' }))
      .toEqual({ screen: 'MealGroupDetail', params: { groupId: 'g1' } });
    expect(notificationTarget('POLL_VOTE_REMINDER', { groupId: 'g9' }))
      .toEqual({ screen: 'MealGroupDetail', params: { groupId: 'g9' } });
  });

  it('FRIEND_REQUEST → Friends, FRIEND_SUGGESTION → FriendSuggestions', () => {
    expect(notificationTarget('FRIEND_REQUEST', { fromUserId: 'u1' })).toEqual({ screen: 'Friends' });
    expect(notificationTarget('FRIEND_SUGGESTION', { suggestedUserId: 'u2' })).toEqual({ screen: 'FriendSuggestions' });
  });

  it('LEVEL_UP / STAR_MILESTONE → Rewards', () => {
    expect(notificationTarget('LEVEL_UP', {})).toEqual({ screen: 'Rewards' });
    expect(notificationTarget('STAR_MILESTONE', {})).toEqual({ screen: 'Rewards' });
  });

  it('WEEKLY_DIGEST → WeeklySummary (data gerekmez)', () => {
    expect(notificationTarget('WEEKLY_DIGEST', {})).toEqual({ screen: 'WeeklySummary' });
    expect(notificationTarget('WEEKLY_DIGEST', null)).toEqual({ screen: 'WeeklySummary' });
  });

  it('parametre eksikse veya bilinmeyen tipte null (no-op)', () => {
    expect(notificationTarget('RESERVATION_CONFIRMED', {})).toBeNull();
    expect(notificationTarget('INSTANT_DISCOUNT', null)).toBeNull();
    expect(notificationTarget('INACTIVITY_REMINDER', {})).toBeNull();
    expect(notificationTarget('BILINMEYEN', { placeId: 'p' })).toBeNull();
  });
});
