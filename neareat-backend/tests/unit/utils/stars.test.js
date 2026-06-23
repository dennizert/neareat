'use strict';

const { getLevel, thresholdForLevel, LEVEL_THRESHOLDS, STAR_AMOUNTS, STAR_LEVEL_DISCOUNTS, RESERVATION_NO_SHOW_PENALTY } = require('../../../src/utils/stars');

// S18-1: eşikler büyütüldü → L1 0–49 · L2 50–99 · L3 100–149 · L4 150–249 · L5 250+.
describe('getLevel', () => {
  it('returns level 1 and "Yeni Kaşif" for 0 stars', () => {
    const result = getLevel(0);
    expect(result.level).toBe(1);
    expect(result.badge).toBe('Yeni Kaşif');
  });

  it('returns level 1 for 49 stars (boundary below level 2)', () => {
    expect(getLevel(49).level).toBe(1);
  });

  it('returns level 2 and "Gastronomi Meraklısı" for 50 stars', () => {
    const result = getLevel(50);
    expect(result.level).toBe(2);
    expect(result.badge).toBe('Gastronomi Meraklısı');
  });

  it('returns level 2 for 99 stars (boundary below level 3)', () => {
    expect(getLevel(99).level).toBe(2);
  });

  it('returns level 3 and "Restoran Uzmanı" for 100 stars', () => {
    const result = getLevel(100);
    expect(result.level).toBe(3);
    expect(result.badge).toBe('Restoran Uzmanı');
  });

  it('returns level 3 for 149 stars (boundary below level 4)', () => {
    expect(getLevel(149).level).toBe(3);
  });

  it('returns level 4 and "NearEat Elçisi" for 150 stars', () => {
    const result = getLevel(150);
    expect(result.level).toBe(4);
    expect(result.badge).toBe('NearEat Elçisi');
  });

  it('returns level 4 for 249 stars (boundary below level 5)', () => {
    expect(getLevel(249).level).toBe(4);
  });

  it('returns level 5 and "Gastronomi Efsanesi" for 250 stars', () => {
    const result = getLevel(250);
    expect(result.level).toBe(5);
    expect(result.badge).toBe('Gastronomi Efsanesi');
  });

  it('returns level 5 for 1000 stars (well above maximum threshold)', () => {
    expect(getLevel(1000).level).toBe(5);
  });
});

describe('thresholdForLevel', () => {
  it('maps each level to its lower star threshold', () => {
    expect(thresholdForLevel(1)).toBe(0);
    expect(thresholdForLevel(2)).toBe(50);
    expect(thresholdForLevel(3)).toBe(100);
    expect(thresholdForLevel(4)).toBe(150);
    expect(thresholdForLevel(5)).toBe(250);
  });

  it('clamps out-of-range levels', () => {
    expect(thresholdForLevel(0)).toBe(LEVEL_THRESHOLDS[1]);
    expect(thresholdForLevel(99)).toBe(LEVEL_THRESHOLDS[5]);
  });
});

describe('STAR_AMOUNTS', () => {
  it('REVIEW equals 5', () => {
    expect(STAR_AMOUNTS.REVIEW).toBe(5);
  });

  it('RECOMMENDATION equals 3', () => {
    expect(STAR_AMOUNTS.RECOMMENDATION).toBe(3);
  });

  it('FRIEND_ADDED equals 1', () => {
    expect(STAR_AMOUNTS.FRIEND_ADDED).toBe(1);
  });

  it('RATING equals 2', () => {
    expect(STAR_AMOUNTS.RATING).toBe(2);
  });

  it('RESERVATION equals 10', () => {
    expect(STAR_AMOUNTS.RESERVATION).toBe(10);
  });

  it('RESERVATION_ATTENDED equals 20', () => {
    expect(STAR_AMOUNTS.RESERVATION_ATTENDED).toBe(20);
  });
});

describe('RESERVATION_NO_SHOW_PENALTY', () => {
  it('equals 10', () => {
    expect(RESERVATION_NO_SHOW_PENALTY).toBe(10);
  });
});

describe('STAR_LEVEL_DISCOUNTS', () => {
  it('level 1 discount is 0', () => {
    expect(STAR_LEVEL_DISCOUNTS[1]).toBe(0);
  });

  it('level 2 discount is 10', () => {
    expect(STAR_LEVEL_DISCOUNTS[2]).toBe(10);
  });

  it('level 3 discount is 15', () => {
    expect(STAR_LEVEL_DISCOUNTS[3]).toBe(15);
  });

  it('level 4 discount is 20', () => {
    expect(STAR_LEVEL_DISCOUNTS[4]).toBe(20);
  });

  it('level 5 discount is 25', () => {
    expect(STAR_LEVEL_DISCOUNTS[5]).toBe(25);
  });
});
