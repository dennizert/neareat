import { Ionicons } from '@expo/vector-icons';

// S11-1 — Merkezi ikon haritası.
// Uygulama "semantik" isimler kullanır (phone, calendar...); altta tek bir aileye
// (Ionicons) map'lenir. İleride aile/ikon değişimi YALNIZCA buradan yapılır.
type IoniconName = keyof typeof Ionicons.glyphMap;

export const ICONS = {
  // İletişim & restoran
  phone: 'call-outline',
  email: 'mail-outline',
  location: 'location-outline',
  address: 'navigate-outline',
  restaurant: 'restaurant-outline',
  reservation: 'calendar-outline',
  calendar: 'calendar-outline',
  campaign: 'megaphone-outline',
  announcement: 'megaphone-outline',
  discount: 'pricetag-outline',
  flash: 'flash-outline',
  new: 'sparkles-outline',
  analytics: 'bar-chart-outline',
  report: 'document-text-outline',
  menu: 'fast-food-outline',
  photo: 'image-outline',
  camera: 'camera-outline',
  // Sosyal & etkileşim
  heart: 'heart',
  heartOutline: 'heart-outline',
  star: 'star',
  starOutline: 'star-outline',
  share: 'share-social-outline',
  checkin: 'flag-outline',
  message: 'chatbubble-ellipses-outline',
  notification: 'notifications-outline',
  social: 'people-outline',
  collection: 'bookmark-outline',
  diary: 'book-outline',
  recommend: 'sparkles-outline',
  // Navigasyon & sekmeler
  home: 'home-outline',
  map: 'map-outline',
  profile: 'person-outline',
  search: 'search-outline',
  filter: 'options-outline',
  settings: 'settings-outline',
  // Genel aksiyonlar
  add: 'add',
  close: 'close',
  delete: 'trash-outline',
  edit: 'create-outline',
  back: 'chevron-back',
  chevronRight: 'chevron-forward',
  check: 'checkmark',
  verified: 'checkmark-circle-outline',
  reject: 'close-circle-outline',
  info: 'information-circle-outline',
  warning: 'warning-outline',
  clock: 'time-outline',
} satisfies Record<string, IoniconName>;

export type IconName = keyof typeof ICONS;

/** Bilinmeyen ad için güvenli yedek glyph. */
export const FALLBACK_ICON: IoniconName = 'help-circle-outline';
