'use strict';

/**
 * Sprint-7 #93 — diary stats çekirdeği (saf fonksiyon).
 */

const { computeDiaryStats } = require('../../../src/controllers/diaryController');

const entry = (over) => ({
  placeId: 'p',
  placeName: 'X',
  placeTypes: ['restaurant'],
  visitedAt: new Date('2026-05-01T12:00:00Z'),
  ...over,
});

describe('computeDiaryStats', () => {
  it('boş listede 0 totals + boş arrayler', () => {
    const s = computeDiaryStats([]);
    expect(s.totalEntries).toBe(0);
    expect(s.uniquePlaces).toBe(0);
    expect(s.topCuisineTags).toEqual([]);
    expect(s.topPlaces).toEqual([]);
    expect(s.monthlyCount).toEqual([]);
    expect(s.firstVisit).toBeNull();
    expect(s.lastVisit).toBeNull();
  });

  it('totalEntries + uniquePlaces (aynı yere 2 ziyaret 1 unique)', () => {
    const s = computeDiaryStats([
      entry({ placeId: 'p1' }),
      entry({ placeId: 'p1', visitedAt: new Date('2026-04-15T12:00:00Z') }),
      entry({ placeId: 'p2' }),
    ]);
    expect(s.totalEntries).toBe(3);
    expect(s.uniquePlaces).toBe(2);
  });

  it('topCuisineTags isimden + types\'tan etiket çıkarır', () => {
    const s = computeDiaryStats([
      entry({ placeName: 'Köşk Kebap' }),
      entry({ placeName: 'Antep Kebabı' }),
      entry({ placeName: 'Pizza Roma' }),
      entry({ placeName: 'Brew Mood', placeTypes: ['cafe'] }),
    ]);
    const tags = s.topCuisineTags.map((t) => t.tag);
    expect(tags).toEqual(expect.arrayContaining(['Kebap', 'Pizza', 'Kafe']));
    expect(s.topCuisineTags.find((t) => t.tag === 'Kebap').count).toBe(2);
  });

  it('topPlaces çoklu ziyaret edileni öne çıkarır', () => {
    const s = computeDiaryStats([
      entry({ placeId: 'p1', placeName: 'Aynı Yer' }),
      entry({ placeId: 'p1', placeName: 'Aynı Yer' }),
      entry({ placeId: 'p1', placeName: 'Aynı Yer' }),
      entry({ placeId: 'p2', placeName: 'Tek Sefer' }),
    ]);
    expect(s.topPlaces[0]).toEqual({ placeId: 'p1', placeName: 'Aynı Yer', count: 3 });
    expect(s.topPlaces[1].count).toBe(1);
  });

  it('monthlyCount kronolojik sırada gruplar', () => {
    const s = computeDiaryStats([
      entry({ visitedAt: new Date('2026-03-10T00:00:00Z') }),
      entry({ visitedAt: new Date('2026-03-22T00:00:00Z') }),
      entry({ visitedAt: new Date('2026-05-05T00:00:00Z') }),
      entry({ visitedAt: new Date('2026-04-01T00:00:00Z') }),
    ]);
    expect(s.monthlyCount).toEqual([
      { month: '2026-03', count: 2 },
      { month: '2026-04', count: 1 },
      { month: '2026-05', count: 1 },
    ]);
  });

  it('firstVisit + lastVisit ISO string olarak döner', () => {
    const s = computeDiaryStats([
      entry({ visitedAt: new Date('2026-01-15T00:00:00Z') }),
      entry({ visitedAt: new Date('2026-05-20T00:00:00Z') }),
      entry({ visitedAt: new Date('2026-03-10T00:00:00Z') }),
    ]);
    expect(s.firstVisit).toBe('2026-01-15T00:00:00.000Z');
    expect(s.lastVisit).toBe('2026-05-20T00:00:00.000Z');
  });

  it('top arrayler 5 ile sınırlı', () => {
    const many = Array.from({ length: 10 }, (_, i) => entry({
      placeId: `p${i}`, placeName: `Yer${i}`,
    }));
    const s = computeDiaryStats(many);
    expect(s.topPlaces).toHaveLength(5);
  });

  it('visitedAt string olarak verilebilir', () => {
    const s = computeDiaryStats([entry({ visitedAt: '2026-06-15T10:00:00.000Z' })]);
    expect(s.monthlyCount).toEqual([{ month: '2026-06', count: 1 }]);
  });
});
