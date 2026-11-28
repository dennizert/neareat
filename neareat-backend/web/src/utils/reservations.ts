// Rezervasyon listesi saf yardımcıları (jest/vitest ile test edilir).
import type { Reservation, ReservationStatus } from '../types';
import type { OccupancyResponse } from '../services/reservations';

export type ReservationTab = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'REJECTED' | 'ALL';

export const RESERVATION_TABS: { key: ReservationTab; label: string }[] = [
  { key: 'PENDING', label: 'Bekleyen' },
  { key: 'CONFIRMED', label: 'Onaylı' },
  { key: 'COMPLETED', label: 'Tamamlandı' },
  { key: 'REJECTED', label: 'Reddedildi' },
  { key: 'ALL', label: 'Tümü' },
];

export function isReservationTab(v: string | null): v is ReservationTab {
  return !!v && RESERVATION_TABS.some((t) => t.key === v);
}

export function countByTab(list: Reservation[]): Record<ReservationTab, number> {
  const c: Record<ReservationTab, number> = { PENDING: 0, CONFIRMED: 0, COMPLETED: 0, REJECTED: 0, ALL: list.length };
  for (const r of list) {
    if (r.status in c) c[r.status as Exclude<ReservationTab, 'ALL'>] += 1;
  }
  return c;
}

export function filterByTab(list: Reservation[], tab: ReservationTab): Reservation[] {
  return tab === 'ALL' ? list : list.filter((r) => r.status === tab);
}

/**
 * S19-4 sıralaması — backend `?status=PENDING` ile aynı: öncelik desc → tarih/saat asc.
 * Backend sırası zaten doğru gelir; bu yalnızca istemcide liste güncellendiğinde (ör. bir
 * satır çıkarıldığında) sırayı korumak ve yedek olarak kullanılır. Kararlı sıralama.
 */
export function sortPending(list: Reservation[]): Reservation[] {
  return list
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const pa = a.r.reservationPriority ?? 0;
      const pb = b.r.reservationPriority ?? 0;
      if (pa !== pb) return pb - pa;
      const ka = `${a.r.date.slice(0, 10)} ${a.r.time}`;
      const kb = `${b.r.date.slice(0, 10)} ${b.r.time}`;
      if (ka !== kb) return ka < kb ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.r);
}

/** Durum değişince listedeki satırı yerinde güncelle. */
export function replaceReservation(list: Reservation[], updated: Pick<Reservation, 'id'> & Partial<Reservation>): Reservation[] {
  return list.map((r) => (r.id === updated.id ? { ...r, ...updated } : r));
}

/** Katılım düğmeleri yalnızca onaylı ve henüz işaretlenmemiş rezervasyonda. */
export function canMarkAttendance(r: Pick<Reservation, 'status' | 'attended'>): boolean {
  return r.status === 'CONFIRMED' && (r.attended === null || r.attended === undefined);
}

export function statusOf(r: Reservation): ReservationStatus {
  return r.status;
}

/** Backend'in yarış mesajları: liste yenilenmeli. */
export const RACE_MESSAGES = ['Yalnızca bekleyen rezervasyonlar güncellenebilir.', 'Katılım durumu zaten işaretlenmiş.', 'Yalnızca onaylanmış rezervasyonlar için katılım işaretlenebilir.'];

export interface CapacityCheck { reserved: number; capacity: number; overflow: boolean }

/**
 * Onay modalındaki kapasite uyarısı: rezervasyon saatindeki dilimin dolu koltuğu + girilen
 * koltuk > kapasite ise uyarı. Onay ENGELLENMEZ (mobil/backend davranışı, S19-3).
 */
export function capacityCheck(occ: OccupancyResponse | null, time: string, seats: number, turnMinutes = TURN_MINUTES): CapacityCheck | null {
  if (!occ || !occ.seatCapacity || !occ.slots?.length) return null;
  const start = toMinutes(time);
  if (start == null) return null;
  // Rezervasyon [time, time+turn) aralığını işgal eder; bu aralığa düşen saatlik dilimlerin
  // en dolusuna bakılır (backend `utils/occupancy` saat başı dilim üretir).
  const fromHour = Math.floor(start / 60) * 60;
  const covered = occ.slots.filter((s) => {
    const m = toMinutes(s.time);
    return m != null && m >= fromHour && m < start + turnMinutes;
  });
  if (!covered.length) return null;
  const reserved = Math.max(...covered.map((s) => s.reserved));
  return { reserved, capacity: occ.seatCapacity, overflow: reserved + seats > occ.seatCapacity };
}

/** Backend `RESERVATION_TURN_MINUTES` varsayılanı (~120). */
export const TURN_MINUTES = 120;

export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
