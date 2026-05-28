export type UserRole = 'USER' | 'RESTAURANT' | 'ADMIN';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  googleId: string | null;
  email: string;
  displayName: string;
  photoUrl: string | null;
  fcmToken: string | null;
  authProvider: 'google' | 'email';
  role: UserRole;
  isSuspended: boolean;
  emailVerified: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  photoUrl: string | null;
  bio: string;
  city: string;
  favoriteCuisines: string[];
  starCount: number;
  level: number;
  badge: string;
  badgeIcon: string;
  isPublic: boolean;
  isPremium?: boolean;
  /** AI öneri motoruna arkadaş tercihi paylaşımı opt-in (Sprint-1 Task #9) */
  shareWithFriendsRecommender?: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  planType: 'monthly' | 'yearly' | 'trial';
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  startedAt: string;
  expiresAt: string;
}

export interface DiscountInfo {
  starDiscountEnabled: boolean;
  starDiscountPercent: number | null;  // kullanıcının seviyesine göre sistem tarafından hesaplanır
  instantActive: boolean;
  instantPercent: number | null;
  note: string | null;
  activeUntil: string | null;
}

export interface Restaurant {
  placeId: string;
  name: string;
  rating: number;
  userRatingsTotal: number;
  priceLevel: number | null;
  types: string[];
  isOpenNow: boolean | null;
  location: { lat: number; lng: number };
  distanceKm: number;
  photoUrl: string | null;
  formattedAddress?: string | null;
  discount?: DiscountInfo | null;
  announcement?: string | null;
  acceptsReservations?: boolean;
}

export interface OpeningHoursPeriodTime {
  day: number;   // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
  time: string;  // "HHMM" yerel saat
}

export interface OpeningHoursPeriod {
  open: OpeningHoursPeriodTime;
  close?: OpeningHoursPeriodTime;
}

export interface RestaurantMenuItemMeta {
  id: string;
  data?: string;
  mimeType: string;
  fileName: string | null;
  sortOrder: number;
  uploadedAt: string;
}

export interface ReviewReply {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  restaurant: { businessName: string };
}

export interface AppReviewWithReply extends AppReview {
  reply: ReviewReply | null;
}

export interface RestaurantDetail extends Restaurant {
  formattedAddress: string;
  formattedPhoneNumber: string | null;
  openingHours: {
    open_now: boolean;
    weekday_text: string[];
    periods?: OpeningHoursPeriod[];
  } | null;
  photos: string[];
  googleReviews: GoogleReview[];
  popularTimes: PopularTimes | null;
  reservationUrl?: string | null;
  openingHoursOverride?: Record<string, { open: string; close: string; closed: boolean }> | null;
  menu?: RestaurantMenuItemMeta[];
  hasMenu?: boolean;
  acceptsReservations?: boolean;
  restaurantId?: string | null;
}

// ─── Restaurant Account ───────────────────────────────────────────────────────

export interface RestaurantProfile {
  id: string;
  userId: string;
  businessName: string;
  ownerName: string;
  taxNumber: string;
  taxOffice: string;
  phone: string;
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
  openingHours: Record<string, { open: string; close: string; closed: boolean }> | null;
  discountEnabled: boolean;
  discountPercent: number | null;
  discountMinStars: number | null;
  discountNote: string | null;
  discountActiveUntil: string | null;
  createdAt: string;
  updatedAt: string;
  menuItems?: RestaurantMenuItemMeta[];
}

export interface RestaurantStats {
  favorites: number;
  reviews: number;
  avgRating: string | null;
  recommendations: number;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminRestaurantSummary {
  id: string;
  businessName: string;
  ownerName: string;
  taxNumber: string;
  taxOffice: string;
  phone: string;
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
  createdAt: string;
  user: { id: string; email: string; displayName: string };
}

export interface AdminStats {
  totalUsers: number;
  totalRestaurants: number;
  approvedRestaurants: number;
  pendingRestaurants: number;
  totalReviews: number;
  totalFavorites: number;
  totalRecommendations: number;
  activePremium: number;
  newUsersToday: number;
  newRestaurantsToday: number;
  activeUsersToday: number;
  activeRestaurantsToday: number;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isSuspended: boolean;
  starCount: number;
  createdAt: string;
  subscription: { status: string; expiresAt: string } | null;
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isOwner?: boolean;
  itemCount: number;
  shareCount?: number;
  owner?: { id: string; displayName: string; photoUrl: string | null };
  items?: CollectionItem[];
  sharedWith?: { id: string; displayName: string; photoUrl: string | null }[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionItem {
  id: string;
  collectionId: string;
  placeId: string;
  placeName: string;
  placeAddress: string | null;
  placePhotoUrl: string | null;
  placeRating: number | null;
  note: string | null;
  addedAt: string;
}

export interface SharedCollection {
  shareId: string;
  sharedAt: string;
  collection: {
    id: string;
    name: string;
    description: string | null;
    itemCount: number;
    owner: { id: string; displayName: string; photoUrl: string | null };
  };
}

export interface GoogleReview {
  author_name: string;
  profile_photo_url: string;
  rating: number;
  relative_time_description: string;
  text: string;
}

export interface PopularTimes {
  [day: number]: { hour: number; percentage: number }[];
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

export interface Favorite {
  id: string;
  placeId: string;
  placeName: string;
  placeAddress: string | null;
  placeLat: number;
  placeLng: number;
  placePhone: string | null;
  placePhotoUrl: string | null;
  placeRating: number | null;
}

export interface Friend {
  id: string;
  userId: string;
  profile: UserProfile;
  createdAt: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromProfile: UserProfile;
  status: 'pending' | 'accepted' | 'rejected';
  note: string | null;
  createdAt: string;
}

export interface Recommendation {
  id: string;
  fromUserId: string;
  fromProfile: UserProfile;
  toUserId: string | null;
  restaurant: Restaurant;
  message: string;
  createdAt: string;
}

// ─── Sosyal Aktivite Akışı (S4-6) ─────────────────────────────────────────────

export type ActivityEventType = 'REVIEW' | 'FAVORITE' | 'RESERVATION' | 'RECOMMENDATION';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  placeId: string | null;
  /** Olaya özgü ek bilgi (örn. { placeName, rating, date, time }) */
  metadata: { placeName?: string | null; rating?: number; date?: string; time?: string } | null;
  createdAt: string;
  user: { id: string; displayName: string | null; photoUrl: string | null };
}

export interface ActivityFeedResponse {
  events: ActivityEvent[];
  nextCursor: string | null;
}

export type StarEventType = 'review' | 'recommendation' | 'friend_added' | 'rating';

export interface StarEvent {
  id: string;
  type: StarEventType;
  amount: number;
  description: string;
  createdAt: string;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  requiredStars: number;
  type: 'badge' | 'gift';
  icon: string;
}

// ─── Reservations ─────────────────────────────────────────────────────────────

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
  occasion: string | null;
  specialRequests: string | null;
  status: ReservationStatus;
  rejectionReason: string | null;
  attended: boolean | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; displayName: string; photoUrl: string | null };
  restaurant: { id: string; businessName: string; placePhotoUrl: string | null; userId: string };
}

export interface ReservationMessage {
  id: string;
  reservationId: string;
  senderId: string;
  senderRole: 'USER' | 'RESTAURANT';
  content: string;
  createdAt: string;
}

export type NotificationType = 'FRIEND_REQUEST' | 'INSTANT_DISCOUNT' | 'LEVEL_UP' | 'RECOMMENDATION' | 'REVIEW_REPLY' | 'FRIEND_SUGGESTION' | 'REPORT_RESOLVED' | 'RESERVATION_REQUEST' | 'RESERVATION_CONFIRMED' | 'RESERVATION_REJECTED' | 'RESERVATION_MESSAGE' | 'RESERVATION_ATTENDED' | 'RESERVATION_NO_SHOW' | 'RESERVATION_CANCELLED' | 'RESERVATION_REMINDER' | 'MEAL_GROUP_INVITE' | 'MEAL_GROUP_JOINED' | 'MEAL_GROUP_POLL' | 'MEAL_GROUP_POLL_CLOSED' | 'FAVORITE_CLOSING_SOON' | 'FAVORITE_ANNOUNCEMENT' | 'STAR_MILESTONE' | 'POLL_VOTE_REMINDER' | 'WEEKLY_DIGEST' | 'INACTIVITY_REMINDER';

// ─── Meal Groups ──────────────────────────────────────────────────────────────

export type MealGroupMemberStatus = 'INVITED' | 'ACCEPTED' | 'DECLINED';
export type PollVoteValue = 'YES' | 'NO' | 'MAYBE';
export type PollStatus = 'OPEN' | 'CLOSED';

export interface PollVote {
  id: string;
  optionId: string;
  userId: string;
  vote: PollVoteValue;
  user: { id: string; displayName: string; photoUrl: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface PollOption {
  id: string;
  pollId: string;
  placeId: string;
  placeName: string;
  placeAddress: string | null;
  placePhotoUrl: string | null;
  placeRating: number | null;
  votes: PollVote[];
  addedAt: string;
}

export interface RestaurantPoll {
  id: string;
  groupId: string;
  creatorId: string;
  creator: { id: string; displayName: string };
  question: string | null;
  status: PollStatus;
  options: PollOption[];
  createdAt: string;
  closedAt: string | null;
  winner?: PollOption | null;
}

export interface MealGroupMember {
  id: string;
  groupId: string;
  userId: string;
  status: MealGroupMemberStatus;
  user: { id: string; displayName: string; photoUrl: string | null };
  createdAt: string;
}

export interface MealGroup {
  id: string;
  name: string;
  creatorId: string;
  creator: { id: string; displayName: string; photoUrl: string | null };
  members: MealGroupMember[];
  polls: RestaurantPoll[];
  myStatus: MealGroupMemberStatus;
  hasOpenPoll?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface Conversation {
  userId: string;
  profile: { id: string; displayName: string; photoUrl: string | null };
  lastMessage: { content: string; createdAt: string; isRead: boolean; isMine: boolean };
  unreadCount: number;
}

export interface UserLog {
  id: string;
  userId: string | null;
  username: string | null;
  email: string | null;
  page: string;
  action: string;
  details: string | null;
  ip: string | null;
  createdAt: string;
}

export interface UserReport {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  actionTaken: string | null;
  createdAt: string;
  reporter: { id: string; displayName: string; email: string };
  reported: { id: string; displayName: string; email: string; isSuspended: boolean };
}

export interface LeaderboardEntry {
  rank: number;
  medal: string;
  maskedName: string;
  starCount: number;
  level: number;
  badge: string;
  badgeIcon: string;
  isMe: boolean;
}

export interface Leaderboard {
  top5: LeaderboardEntry[];
  myRank: number;
  myStarCount: number;
}

export interface FriendSuggestion {
  userId: string;
  maskedName: string;
  photoUrl: string | null;
  city: string | null;
  starCount: number;
  level: number;
  badge: string;
  badgeIcon: string;
  matchScore: number;
  matchReasons: string[];
  commonFavorites: number;
  commonCollections: number;
  commonCuisines: number;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

export type SortOption = 'distance' | 'rating' | 'userRatingsTotal';

export interface FilterState {
  cuisineTypes: string[];
  openNow: boolean;
  priceLevels: number[];
}

// ─── AI Yemek Önerisi (Sprint-1 Task #7) ─────────────────────────────────────
//
// İsim çakışması notu: mevcut `Recommendation` interface'i (sosyal feature —
// kullanıcılar arası restoran önerisi) ile karışmasın diye AI öneri için
// `AiRecommendation*` prefix kullanılıyor. Backend tarafında da aynı pattern:
// `AiRecommendationLog` model + `POST /api/recommendations/dinner-tonight`.

export type FeedbackSentiment = 'positive' | 'negative';

export interface FeedbackRequest {
  placeId: string;
  sentiment: FeedbackSentiment;
  aiRecommendationLogId?: string | null;
  comment?: string | null;
  visited?: boolean;
  /** Mekanın Google place types'ı — backend mutfak tipi aggregate'i için (S4-7) */
  placeTypes?: string[];
}

/** AI öneri motoruna istek payload'ı */
export interface AiRecommendationRequest {
  lat: number;
  lng: number;
}

/** Bir restoranın AI tarafında oluşturulan kişisel öneri detayı */
export interface AiRecommendation {
  placeId: string;
  /** LLM'in 2-3 cümle kişisel gerekçesi */
  reason: string;
  /** Kullanıcının daha önce bu mekânı favorilememesi veya yorum yazmaması */
  neverVisited?: boolean;
  restaurant: {
    name: string;
    types: string[];
    rating: number | null;
    userRatingsTotal: number | null;
    priceLevel: number | null;
    vicinity: string | null;
    location: { lat: number; lng: number } | null;
    distanceKm: number;
    openNow: boolean | null;
    photoUrl: string | null;
  };
}

/** AI öneri motorunun başarılı response'u */
export interface AiRecommendationResponse {
  recommendations: AiRecommendation[];
  /** LLM'in kullanıcıya ekstra notu (örn. "Yakında pek uygun seçenek yok"). Boş olabilir. */
  noteToUser: string;
  tier: 'free' | 'premium';
  /** Kullanılan model id — debug/log için */
  model: string;
  /** Free tier kalan günlük hak. Premium ise null. */
  remainingToday: number | null;
  /** Free tier limit reset zamanı (ISO). Premium ise null. */
  resetAt: string | null;
  latencyMs: number;
}

/** Free tier 429 LIMIT_EXCEEDED response shape (custom error içinde taşınır) */
export interface AiRecommendationLimitInfo {
  message: string;
  resetAt: string;
}

export type StreamingStatus = 'idle' | 'streaming' | 'done' | 'error' | 'cancelled';

/** Rota üzerindeki restoran — sequenceOrder ile sıralı duraklar */
export interface RouteRestaurant {
  name: string;
  types: string[];
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  vicinity: string | null;
  location: { lat: number; lng: number } | null;
  distanceKm: number;
  openNow: boolean | null;
  photoUrl: string | null;
  sequenceOrder: number;
  /** Rotadan sapma tahmini (km) — distanceKm × 2 round-trip */
  detourKm?: number | null;
  /** Tahmini varış saatinde açık mı? null = bilgi yok */
  openAtArrival?: boolean | null;
}

/** Rota öneri tek eleman */
export interface RouteRecommendation {
  placeId: string;
  reason: string;
  restaurant: RouteRestaurant;
}

/** POST /api/recommendations/route-tonight request payload */
export interface RouteRecommendationRequest {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  /** ISO date string — yola çıkış zamanı (opsiyonel) */
  departureTime?: string;
}

/** POST /api/recommendations/route-tonight başarılı response */
export interface RouteRecommendationResponse {
  recommendations: RouteRecommendation[];
  totalRouteDistanceKm: number;
  totalRouteDurationMin: number;
  noteToUser: string;
  tier: 'free' | 'premium';
  model: string;
  remainingToday: number | null;
  resetAt: string | null;
  latencyMs: number;
}

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  RestaurantDetail: { placeId: string };
  Paywall: { trigger: 'favorites' | 'reviews' | 'popular_times' | 'onboarding' | 'collections' };
  EditProfile: undefined;
  Friends: undefined;
  ActivityFeed: undefined;
  FriendSuggestions: undefined;
  FriendProfile: { userId: string };
  SendRecommendation: {
    placeId: string;
    placeName: string;
    photoUrl: string | null;
    rating: number;
  };
  Rewards: undefined;
  Register: undefined;
  Collections: undefined;
  CollectionDetail: { collectionId: string; title?: string };
  Conversation: { userId: string; displayName: string; photoUrl?: string | null };
  // Meal Groups
  MealGroups: undefined;
  MealGroupDetail: { groupId: string; groupName: string };
  CreateMealGroup: undefined;
  // Reservations
  MakeReservation: { placeId: string; placeName: string; restaurantId: string };
  MyReservations: undefined;
  ReservationDetail: { reservationId: string };
  EditReservation: { reservationId: string };
  RestaurantReservations: undefined;
  // Restaurant account
  RestaurantRegister: undefined;
  RestaurantPending: { status: ApprovalStatus; rejectionReason?: string | null };
  RestaurantDashboard: undefined;
  RestaurantHours: undefined;
  RestaurantMenu: undefined;
  RestaurantDiscount: undefined;
  RestaurantReviews: undefined;
  RestaurantInfo: undefined;
  // Admin
  AdminDashboard: undefined;
  AdminRestaurantDetail: { restaurantId: string };
  AdminLogs: undefined;
  // Notifications
  Notifications: undefined;
  // AI Recommendation (Sprint-1 Task #8)
  Recommendation: undefined;
  // Route recommendation (Sprint-3 Task #8)
  RouteRecommendation: undefined;
  // AI-specific paywall (Sprint-1 Task #10)
  PremiumUpsell: { resetAt?: string };
};

export type MainTabParamList = {
  Home: undefined;
  Favorites: undefined;
  Collections: undefined;
  Messages: undefined;
  Profile: undefined;
};
