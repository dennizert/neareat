// S19-5/S19-6: Doluluk bandı sunumu (saf). Kullanıcıya ham yüzde DEĞİL, anlamlı bant +
// renk gösterilir: Müsait / Az yer kaldı / Dolu. Backend `occupancyBand` ile aynı bant adları.

export type OccupancyBand = 'available' | 'limited' | 'full' | 'unknown';

/** Bant → Türkçe etiket. 'unknown' → null (gösterme). */
export function bandLabel(band: string | null | undefined): string | null {
  switch (band) {
    case 'available': return 'Müsait';
    case 'limited': return 'Az yer kaldı';
    case 'full': return 'Dolu';
    default: return null;
  }
}

/** Bant → semantik renk anahtarı (tema renkleriyle eşlenir). */
export function bandColorKey(band: string | null | undefined): 'success' | 'warning' | 'danger' | 'muted' {
  switch (band) {
    case 'available': return 'success';
    case 'limited': return 'warning';
    case 'full': return 'danger';
    default: return 'muted';
  }
}

/** Bant gösterilmeli mi? (bilinmiyor/boş → gizle.) */
export function shouldShowBand(band: string | null | undefined): boolean {
  return band === 'available' || band === 'limited' || band === 'full';
}

/**
 * Trial bitişine kalan gün (gün cinsinden, yukarı yuvarlanır). expiresAt geçmiş/yoksa null/0.
 * Restoran trial sayacı için.
 */
export function trialDaysLeft(expiresAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return null;
  const diff = exp - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}
