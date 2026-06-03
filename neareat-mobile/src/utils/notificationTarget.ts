// NOTIF-1 — Bildirim tipini + data'sını navigasyon hedefine eşler.
// Saf fonksiyon (kolay test). Hedef ekran, ilgili rolün Notifications'ıyla aynı
// root stack'te kayıtlıdır → navigation.navigate doğrudan çalışır.

export interface NavTarget {
  screen: string;
  params?: Record<string, unknown>;
}

const PLACE_TYPES = new Set([
  'INSTANT_DISCOUNT',
  'REVIEW_REPLY',
  'FAVORITE_ANNOUNCEMENT',
  'FAVORITE_CLOSING_SOON',
  'RECOMMENDATION',
]);

/**
 * Bir bildirimin yönlendirme hedefini döner; eşleşme/parametre yoksa null (no-op).
 * @param type Bildirim tipi (Notification.type)
 * @param data Bildirim data payload'u (Notification.data)
 */
export function notificationTarget(type: string, data?: Record<string, any> | null): NavTarget | null {
  const d = data ?? {};

  // Rezervasyonlar — tüm RESERVATION_* tipleri reservationId taşır
  if (type.startsWith('RESERVATION_') && d.reservationId) {
    return { screen: 'ReservationDetail', params: { reservationId: d.reservationId } };
  }

  // Mekan bazlı — placeId ile restoran detayına
  if (PLACE_TYPES.has(type) && d.placeId) {
    return { screen: 'RestaurantDetail', params: { placeId: d.placeId } };
  }

  // Grup yemekleri — groupId ile grup detayına
  if ((type.startsWith('MEAL_GROUP_') || type === 'POLL_VOTE_REMINDER') && d.groupId) {
    return { screen: 'MealGroupDetail', params: { groupId: d.groupId } };
  }

  // Sosyal
  if (type === 'FRIEND_REQUEST') return { screen: 'Friends' };
  if (type === 'FRIEND_SUGGESTION') return { screen: 'FriendSuggestions' };

  // Ödüller / seviye
  if (type === 'LEVEL_UP' || type === 'STAR_MILESTONE') return { screen: 'Rewards' };

  // Eşleşmeyen / hedefsiz (WEEKLY_DIGEST, INACTIVITY_REMINDER vb.) → no-op
  return null;
}
