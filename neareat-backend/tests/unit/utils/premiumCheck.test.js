'use strict';

const { isActivePremium, PREMIUM_STATUSES } = require('../../../src/utils/premiumCheck');

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

describe('isActivePremium', () => {
  it('returns false for null subscription', () => {
    expect(isActivePremium(null)).toBe(false);
  });

  it('returns false for undefined subscription', () => {
    expect(isActivePremium(undefined)).toBe(false);
  });

  it('returns true for active status with a future expiry date', () => {
    expect(isActivePremium({ status: 'active', expiresAt: futureDate })).toBe(true);
  });

  it('returns true for trial status with a future expiry date', () => {
    expect(isActivePremium({ status: 'trial', expiresAt: futureDate })).toBe(true);
  });

  it('returns false for active status with a past expiry date', () => {
    expect(isActivePremium({ status: 'active', expiresAt: pastDate })).toBe(false);
  });

  it('returns false for trial status with a past expiry date', () => {
    expect(isActivePremium({ status: 'trial', expiresAt: pastDate })).toBe(false);
  });

  it('returns false for cancelled status even with a future expiry date', () => {
    expect(isActivePremium({ status: 'cancelled', expiresAt: futureDate })).toBe(false);
  });

  it('returns false for expired status even with a future expiry date', () => {
    expect(isActivePremium({ status: 'expired', expiresAt: futureDate })).toBe(false);
  });

  it('returns false when expiresAt is exactly now (not strictly greater)', () => {
    expect(isActivePremium({ status: 'active', expiresAt: new Date() })).toBe(false);
  });
});

describe('PREMIUM_STATUSES', () => {
  it('includes "active"', () => {
    expect(PREMIUM_STATUSES).toContain('active');
  });

  it('includes "trial"', () => {
    expect(PREMIUM_STATUSES).toContain('trial');
  });

  it('has exactly 2 elements', () => {
    expect(PREMIUM_STATUSES).toHaveLength(2);
  });
});
