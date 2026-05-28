'use strict';

/**
 * Sprint-4 Task #2 — recommendationSession unit tests.
 * Redis mock'lu; cache key, TTL ve get/save/clear davranışı.
 */

const mockRedis = {
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
};
jest.mock('../../../src/services/redis', () => mockRedis);

const {
  newSessionId,
  getSession,
  saveSession,
  clearSession,
  sessionKey,
  SESSION_TTL,
} = require('../../../src/services/recommendationSession');

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.cacheGet.mockResolvedValue(null);
});

describe('newSessionId', () => {
  it('benzersiz UUID üretir', () => {
    const a = newSessionId();
    const b = newSessionId();
    expect(typeof a).toBe('string');
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });
});

describe('sessionKey', () => {
  it('namespace prefix uygular', () => {
    expect(sessionKey('abc')).toBe('rec-session:abc');
  });
});

describe('getSession', () => {
  it('sessionId yoksa null döner, Redis sorgulamaz', async () => {
    expect(await getSession(null)).toBeNull();
    expect(await getSession('')).toBeNull();
    expect(mockRedis.cacheGet).not.toHaveBeenCalled();
  });

  it('Redis\'ten doğru key ile okur', async () => {
    const ctx = { userId: 'u1', suggestedPlaceIds: ['p1'], refinements: [] };
    mockRedis.cacheGet.mockResolvedValue(ctx);

    const result = await getSession('s1');

    expect(result).toEqual(ctx);
    expect(mockRedis.cacheGet).toHaveBeenCalledWith('rec-session:s1');
  });
});

describe('saveSession', () => {
  it('doğru key + TTL ile yazar', async () => {
    const data = { userId: 'u1', location: { lat: 1, lng: 2 }, suggestedPlaceIds: ['p1'], refinements: ['daha ucuz'] };

    await saveSession('s1', data);

    expect(mockRedis.cacheSet).toHaveBeenCalledWith('rec-session:s1', data, SESSION_TTL);
    expect(SESSION_TTL).toBe(30 * 60);
  });
});

describe('clearSession', () => {
  it('sessionId varsa Redis\'ten siler', async () => {
    await clearSession('s1');
    expect(mockRedis.cacheDel).toHaveBeenCalledWith('rec-session:s1');
  });

  it('sessionId yoksa hiçbir şey yapmaz', async () => {
    await clearSession(null);
    expect(mockRedis.cacheDel).not.toHaveBeenCalled();
  });
});
