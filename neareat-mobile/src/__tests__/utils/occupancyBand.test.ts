import { bandLabel, bandColorKey, shouldShowBand, trialDaysLeft } from '../../utils/occupancyBand';

describe('occupancyBand', () => {
  describe('bandLabel', () => {
    it('bant → Türkçe etiket; bilinmeyen → null', () => {
      expect(bandLabel('available')).toBe('Müsait');
      expect(bandLabel('limited')).toBe('Az yer kaldı');
      expect(bandLabel('full')).toBe('Dolu');
      expect(bandLabel('unknown')).toBeNull();
      expect(bandLabel(undefined)).toBeNull();
    });
  });

  describe('bandColorKey', () => {
    it('bant → semantik renk', () => {
      expect(bandColorKey('available')).toBe('success');
      expect(bandColorKey('limited')).toBe('warning');
      expect(bandColorKey('full')).toBe('danger');
      expect(bandColorKey('unknown')).toBe('muted');
    });
  });

  describe('shouldShowBand', () => {
    it('yalnızca bilinen bantlarda true', () => {
      expect(shouldShowBand('available')).toBe(true);
      expect(shouldShowBand('full')).toBe(true);
      expect(shouldShowBand('unknown')).toBe(false);
      expect(shouldShowBand(null)).toBe(false);
    });
  });

  describe('trialDaysLeft', () => {
    const now = new Date('2026-06-23T00:00:00Z');
    it('kalan günü yukarı yuvarlar', () => {
      expect(trialDaysLeft('2026-06-25T00:00:00Z', now)).toBe(2);
      expect(trialDaysLeft('2026-06-25T12:00:00Z', now)).toBe(3); // 2.5 → 3
    });
    it('geçmiş → 0, yok/geçersiz → null', () => {
      expect(trialDaysLeft('2026-06-20T00:00:00Z', now)).toBe(0);
      expect(trialDaysLeft(null, now)).toBeNull();
      expect(trialDaysLeft('abc', now)).toBeNull();
    });
  });
});
