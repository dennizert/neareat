'use strict';

const { haversineKm } = require('../../../src/utils/haversine');

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    expect(haversineKm(41.0082, 28.9784, 41.0082, 28.9784)).toBeCloseTo(0, 5);
  });

  it('returns approximately 352 km from Istanbul to Ankara', () => {
    const dist = haversineKm(41.0082, 28.9784, 39.9334, 32.8597);
    expect(dist).toBeGreaterThan(347);
    expect(dist).toBeLessThan(357);
  });

  it('is symmetric: distance(A,B) equals distance(B,A)', () => {
    const ab = haversineKm(41.0082, 28.9784, 39.9334, 32.8597);
    const ba = haversineKm(39.9334, 32.8597, 41.0082, 28.9784);
    expect(ab).toBeCloseTo(ba, 5);
  });

  it('returns approximately 20015 km for antipodal points (0,0) to (0,180)', () => {
    const dist = haversineKm(0, 0, 0, 180);
    expect(dist).toBeGreaterThan(20010);
    expect(dist).toBeLessThan(20020);
  });

  it('returns 0 for zero coordinates from themselves', () => {
    expect(haversineKm(0, 0, 0, 0)).toBeCloseTo(0, 5);
  });

  it('returns less than 1 km for a small distance (same street)', () => {
    const dist = haversineKm(41.0082, 28.9784, 41.0088, 28.9791);
    expect(dist).toBeLessThan(1);
  });

  it('returns a number and not NaN', () => {
    const dist = haversineKm(41.0082, 28.9784, 39.9334, 32.8597);
    expect(typeof dist).toBe('number');
    expect(isNaN(dist)).toBe(false);
  });
});
