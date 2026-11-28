// Web paneli tipleri — mobil `neareat-mobile/src/types/index.ts` ile aynı adlar/alanlar.
// Sözleşme backend'den gelir; burada yalnızca panelin tükettiği alanlar tutulur.

export type UserRole = 'USER' | 'RESTAURANT' | 'ADMIN';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** `GET /api/auth/web/session` → `user` (sanitizeUser çıktısı; burada kullanılan alt küme). */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoUrl?: string | null;
  authProvider?: string;
  emailVerified?: boolean;
}

/** Oturumdaki restoranın panel kararları için gereken özeti. */
export interface RestaurantSummary {
  status: ApprovalStatus;
  rejectionReason: string | null;
  businessName: string;
  displayName?: string | null;
}

export type MfaState = 'none' | 'required' | 'enroll';

export interface WebSessionPayload {
  user: SessionUser;
  csrfToken: string;
  mfa: MfaState;
  /** Backend eklerse kullanılır; yoksa `GET /restaurant-account/me` ile tamamlanır. */
  restaurantProfile?: RestaurantSummary | null;
}

export interface OpeningHoursDay { open: string; close: string; closed: boolean }
export type OpeningHours = Record<string, OpeningHoursDay>;

export interface RestaurantMenuItemMeta {
  id: string;
  data?: string;
  mimeType: string;
  fileName: string | null;
  sortOrder: number;
  uploadedAt: string;
}

export interface RestaurantProfile {
  id: string;
  userId: string;
  businessName: string;
  displayName: string | null;
  ownerName: string;
  taxNumber: string;
  taxOffice: string;
  phone: string;
  altPhone: string | null;
  contactEmail: string;
  address: string;
  businessCategory: string;
  placeId: string | null;
  placeName: string | null;
  placeAddress: string | null;
  placePhotoUrl: string | null;
  status: ApprovalStatus;
  rejectionReason: string | null;
  approvedAt: string | null;
  reservationUrl: string | null;
  announcement: string | null;
  announcementActive: boolean;
  acceptsReservations: boolean;
  tableCount: number | null;
  seatCapacity: number | null;
  openingHours: OpeningHours | null;
  discountEnabled: boolean;
  discountPercent: number | null;
  discountMinStars: number | null;
  discountNote: string | null;
  discountActiveUntil: string | null;
  starDiscountEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
  menuItems?: RestaurantMenuItemMeta[];
}

export type RestaurantPhotoKind = 'RESTAURANT' | 'PRODUCT';

export interface RestaurantPhoto {
  id: string;
  kind: RestaurantPhotoKind;
  url: string;
  sortOrder: number;
  createdAt: string;
}

export interface RestaurantStats {
  favorites: number;
  reviews: number;
  avgRating: string | null;
  recommendations: number;
}

export interface RestaurantAnalytics {
  reservations: {
    totalReservations: number;
    trend: { date: string; count: number }[];
    busiestHours: { hour: string; count: number }[];
    statusBreakdown: { PENDING: number; CONFIRMED: number; REJECTED: number; CANCELLED: number; COMPLETED: number };
    attendanceRate: number | null;
  };
  reviews: {
    reviewCount: number;
    avgRating: number | null;
    distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  };
}

export interface WeeklyReport {
  report: string;
  model: string | null;
  fallback: boolean;
  generatedAt: string;
}

export interface ReviewReply {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  restaurant: { businessName: string };
}

export interface AppReview {
  id: string;
  userId: string;
  placeId: string;
  rating: number;
  body: string;
  createdAt: string;
  user: { displayName: string; photoUrl: string | null };
  reply?: ReviewReply | null;
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';

export interface Reservation {
  id: string;
  userId: string;
  restaurantId: string;
  placeId: string;
  placeName: string;
  date: string;
  time: string;
  guestCount: number;
  reservedSeats?: number | null;
  occasion: string | null;
  specialRequests: string | null;
  status: ReservationStatus;
  rejectionReason: string | null;
  attended: boolean | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; displayName: string; photoUrl: string | null };
  restaurant?: { id: string; businessName: string; displayName: string | null; placePhotoUrl: string | null; userId: string };
  userLevel?: number;
  reservationPriority?: number;
  isPriority?: boolean;
  warning?: string;
  message?: string;
}

export interface ReservationMessage {
  id: string;
  reservationId: string;
  senderId: string;
  senderRole: 'USER' | 'RESTAURANT';
  content: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planType?: string;
  status: 'active' | 'trial' | 'cancelled' | 'expired' | string;
  startedAt?: string;
  expiresAt: string | null;
}

/** Başvuru adımındaki Google Places sonucu (`/restaurants/nearby`, `/places/search`). */
export interface PlaceResult {
  placeId: string;
  name: string;
  formattedAddress?: string | null;
  vicinity?: string | null;
  address?: string | null;
  photoUrl?: string | null;
}
