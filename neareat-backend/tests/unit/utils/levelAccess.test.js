'use strict';

const { getLevelAccess, isUnlimited, LEVEL_ACCESS } = require('../../../src/utils/levelAccess');

describe('getLevelAccess', () => {
  it('L1: no reservation, 1 AI/day, no lists, 5 favorites, no suggest, no priority', () => {
    const a = getLevelAccess(1);
    expect(a.maxReservationsPerMonth).toBe(0);
    expect(a.aiPerDay).toBe(1);
    expect(a.canCreateLists).toBe(false);
    expect(a.favoritesLimit).toBe(5);
    expect(a.canSuggestRestaurant).toBe(false);
    expect(a.reservationPriority).toBe(0);
  });

  it('L2: 1 reservation/month, 5 AI/day, lists, 15 favorites', () => {
    const a = getLevelAccess(2);
    expect(a.maxReservationsPerMonth).toBe(1);
    expect(a.aiPerDay).toBe(5);
    expect(a.canCreateLists).toBe(true);
    expect(a.favoritesLimit).toBe(15);
    expect(a.canSuggestRestaurant).toBe(false);
    expect(a.reservationPriority).toBe(0);
  });

  it('L3: unlimited reservations + priority + suggest, 10 AI/day, 30 favorites', () => {
    const a = getLevelAccess(3);
    expect(isUnlimited(a.maxReservationsPerMonth)).toBe(true);
    expect(a.aiPerDay).toBe(10);
    expect(a.favoritesLimit).toBe(30);
    expect(a.canSuggestRestaurant).toBe(true);
    expect(a.reservationPriority).toBe(1);
  });

  it('L4: 20 AI/day, 50 favorites, priority 2', () => {
    const a = getLevelAccess(4);
    expect(a.aiPerDay).toBe(20);
    expect(a.favoritesLimit).toBe(50);
    expect(a.reservationPriority).toBe(2);
  });

  it('L5: everything unlimited, priority 3', () => {
    const a = getLevelAccess(5);
    expect(isUnlimited(a.maxReservationsPerMonth)).toBe(true);
    expect(isUnlimited(a.aiPerDay)).toBe(true);
    expect(isUnlimited(a.favoritesLimit)).toBe(true);
    expect(a.canSuggestRestaurant).toBe(true);
    expect(a.reservationPriority).toBe(3);
  });

  it('clamps out-of-range / invalid levels to L1', () => {
    expect(getLevelAccess(0)).toEqual(LEVEL_ACCESS[1]);
    expect(getLevelAccess(99)).toEqual(LEVEL_ACCESS[5]);
    expect(getLevelAccess(undefined)).toEqual(LEVEL_ACCESS[1]);
    expect(getLevelAccess(NaN)).toEqual(LEVEL_ACCESS[1]);
  });
});

describe('isUnlimited', () => {
  it('treats null as unlimited, numbers as bounded', () => {
    expect(isUnlimited(null)).toBe(true);
    expect(isUnlimited(0)).toBe(false);
    expect(isUnlimited(5)).toBe(false);
  });
});
