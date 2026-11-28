// Doluluk bandı sunumu — mobil `neareat-mobile/src/utils/occupancyBand.ts` ile BİREBİR.
// Bant adları backend `utils/occupancy.occupancyBand` ile aynı: <%70 Müsait, %70+ Az yer kaldı, %100 Dolu.

export type OccupancyBand = 'available' | 'limited' | 'full' | 'unknown';

export function bandLabel(band: string | null | undefined): string | null {
  switch (band) {
    case 'available': return 'Müsait';
    case 'limited': return 'Az yer kaldı';
    case 'full': return 'Dolu';
    default: return null;
  }
}

export function bandColorKey(band: string | null | undefined): 'success' | 'warning' | 'danger' | 'muted' {
  switch (band) {
    case 'available': return 'success';
    case 'limited': return 'warning';
    case 'full': return 'danger';
    default: return 'muted';
  }
}

export function shouldShowBand(band: string | null | undefined): boolean {
  return band === 'available' || band === 'limited' || band === 'full';
}

/** Backend bant göndermediğinde yüzdeden bant (mobil/backend eşikleriyle aynı). */
export function bandForPercent(percent: number | null | undefined, limitedPct = 70): OccupancyBand {
  if (percent == null || Number.isNaN(percent)) return 'unknown';
  if (percent >= 100) return 'full';
  if (percent >= limitedPct) return 'limited';
  return 'available';
}

export function trialDaysLeft(expiresAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return null;
  const diff = exp - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}
