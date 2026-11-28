// Biçim kuralları (BILESENLER §3): tarih `28 Kas 2026` / `28 Kasım 2026, Cuma`, saat `19:00`,
// yüzde `%22`, ondalık virgül.
const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const MONTHS_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/** `YYYY-MM-DD` veya ISO → yerel takvim günü. `YYYY-MM-DD` saat dilimi kaydırmadan yorumlanır. */
export function parseDay(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}

export function formatDateShort(value: string | Date): string {
  const d = typeof value === 'string' ? parseDay(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateLong(value: string | Date): string {
  const d = typeof value === 'string' ? parseDay(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}, ${DAYS[d.getDay()]}`;
}

export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDateShort(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Yerel takvim günü → `YYYY-MM-DD`. */
export function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(isoDay: string, n: number): string {
  const d = parseDay(isoDay);
  d.setDate(d.getDate() + n);
  return toIsoDay(d);
}

export function formatDecimal(n: number | string | null | undefined, digits = 1): string {
  if (n == null || n === '') return '—';
  const v = typeof n === 'string' ? Number(n) : n;
  if (Number.isNaN(v)) return '—';
  return v.toFixed(digits).replace('.', ',');
}

export function formatPercent(n: number): string {
  return `%${Math.round(n)}`;
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? 'E').toLocaleUpperCase('tr') + (parts[1]?.[0] ?? '').toLocaleUpperCase('tr');
}
