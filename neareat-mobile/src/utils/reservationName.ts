// Rezervasyon ekranlarında gösterilecek restoran adını çözer.
// Kural: Restoranın "Görünen Ad"ı (displayName) varsa o, yoksa Google adı (placeName).
// Backend RESERVATION_SELECT artık restaurant.displayName döner; placeName ise
// rezervasyon oluşturulurken kaydedilen Google adıdır.

interface ReservationLike {
  placeName: string;
  restaurant?: { displayName?: string | null; businessName?: string | null } | null;
}

export function reservationRestaurantName(reservation: ReservationLike): string {
  const display = reservation.restaurant?.displayName?.trim();
  if (display) return display;
  return reservation.placeName || reservation.restaurant?.businessName?.trim() || 'Restoran';
}
