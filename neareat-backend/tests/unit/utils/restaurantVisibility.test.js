'use strict';

// S19-1 — kayıtlı restoran görünürlük where fragmanı (ENFORCE_RESTAURANT_SUBSCRIPTION flag).

const { registeredProfileWhere, enforcementEnabled } = require('../../../src/utils/restaurantVisibility');

afterEach(() => { delete process.env.ENFORCE_RESTAURANT_SUBSCRIPTION; });

describe('registeredProfileWhere', () => {
  it('flag KAPALI (varsayılan): yalnızca status=APPROVED, abonelik şartı yok', () => {
    const where = registeredProfileWhere({ placeId: 'p1' });
    expect(where).toEqual({ placeId: 'p1', status: 'APPROVED' });
    expect(where.user).toBeUndefined();
  });

  it('flag AÇIK: status=APPROVED + sahibinin aktif aboneliği şartı', () => {
    process.env.ENFORCE_RESTAURANT_SUBSCRIPTION = 'true';
    const now = new Date('2026-06-23T00:00:00Z');
    const where = registeredProfileWhere({ placeId: { in: ['p1', 'p2'] } }, now);
    expect(where.status).toBe('APPROVED');
    expect(where.user.subscription.is.status.in).toEqual(['active', 'trial']);
    expect(where.user.subscription.is.expiresAt.gt).toBe(now);
  });

  it('enforcementEnabled flag ile uyumlu', () => {
    expect(enforcementEnabled()).toBe(false);
    process.env.ENFORCE_RESTAURANT_SUBSCRIPTION = 'true';
    expect(enforcementEnabled()).toBe(true);
  });
});
