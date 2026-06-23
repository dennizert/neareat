import { Alert } from 'react-native';

/**
 * S18-5: Kullanıcı premium'u kaldırıldı; özellikler yıldız SEVİYESİNE göre açılır.
 * Bu modül backend `LEVEL_REQUIRED` hatalarını ele alır (Paywall'a değil, "seviye atla"
 * bilgisine yönlendirir) ve seviye/ilerleme hesabı için saf yardımcılar sağlar.
 * Eşikler backend (`utils/stars.getLevel`) ile birebir aynı tutulmalı.
 */

// Seviye alt eşikleri (index = level-1). L1 0 · L2 50 · L3 100 · L4 150 · L5 250.
export const LEVEL_THRESHOLDS = [0, 50, 100, 150, 250];

const LEVEL_BADGES = [
  'Yeni Kaşif',
  'Gastronomi Meraklısı',
  'Restoran Uzmanı',
  'NearEat Elçisi',
  'Gastronomi Efsanesi',
];

/** Yıldız sayısından seviye (1–5). */
export function levelForStars(stars: number): number {
  const s = stars ?? 0;
  if (s >= 250) return 5;
  if (s >= 150) return 4;
  if (s >= 100) return 3;
  if (s >= 50) return 2;
  return 1;
}

/** Bir sonraki seviyenin alt eşiği — L5'te null (sınırsız). */
export function nextLevelThreshold(stars: number): number | null {
  const lvl = levelForStars(stars);
  if (lvl >= 5) return null;
  return LEVEL_THRESHOLDS[lvl]; // index lvl = (lvl+1). seviyesinin eşiği
}

/** Bir sonraki seviyeye kalan yıldız — L5'te null. */
export function starsToNextLevel(stars: number): number | null {
  const next = nextLevelThreshold(stars);
  return next === null ? null : Math.max(0, next - (stars ?? 0));
}

/** Seviye rozeti adı. */
export function levelBadge(level: number): string {
  const idx = Math.min(5, Math.max(1, level)) - 1;
  return LEVEL_BADGES[idx];
}

/**
 * Backend hatası "seviye gerekli" mi? Limit dolan seviye-bazlı gate'ler
 * 403 { code: 'LEVEL_REQUIRED', requiredLevel, feature } döner.
 */
export function isLevelRequired(err: any): boolean {
  const code = err?.response?.data?.code ?? err?.code;
  return code === 'LEVEL_REQUIRED';
}

/** Gate hatasından kullanıcıya gösterilecek Türkçe mesaj (backend mesajı tercih edilir). */
export function levelGateMessage(err: any): string {
  const data = err?.response?.data ?? {};
  if (data.error) return data.error;
  const req = data.requiredLevel;
  return req
    ? `Bu özellik Seviye ${req} ile açılır.`
    : 'Bu özellik daha yüksek bir seviye gerektirir.';
}

/**
 * LEVEL_REQUIRED hatasını ele alır: ödeme yerine "seviye atla" bilgisi gösterir.
 * Paywall'a YÖNLENDİRMEZ. opts.onInfo verilirse onunla (toast/sheet), yoksa Alert.
 * @returns hata ele alındıysa true (çağıran ayrıca hata göstermemeli).
 */
export function handleLevelError(err: any, opts?: { onInfo?: (msg: string) => void }): boolean {
  if (!isLevelRequired(err)) return false;
  const msg = levelGateMessage(err);
  if (opts?.onInfo) opts.onInfo(msg);
  else Alert.alert('Seviye Gerekli', msg);
  return true;
}
