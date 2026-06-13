'use strict';

/**
 * S16-6 — cron leader-lock davranışı.
 * Kilit alınırsa fn çalışır; alınamazsa atlanır; Redis hatasında fail-open (çalışır).
 */

const mockSet = jest.fn();
jest.mock('../../../src/services/redis', () => ({
  getRedis: () => ({ set: mockSet }),
}));

const { withCronLock } = require('../../../src/services/cronLock');

beforeEach(() => jest.clearAllMocks());

describe('withCronLock', () => {
  it('kilit alınırsa (SET OK) fn çalışır', async () => {
    mockSet.mockResolvedValueOnce('OK');
    const fn = jest.fn().mockResolvedValue('done');
    const res = await withCronLock('job1', fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(res).toBe('done');
    // SET key val PX <ttl> NX deseni
    expect(mockSet).toHaveBeenCalledWith('cron-lock:job1', expect.any(String), 'PX', expect.any(Number), 'NX');
  });

  it('kilit alınamazsa (SET null) fn çalışmaz, { skipped:true } döner', async () => {
    mockSet.mockResolvedValueOnce(null);
    const fn = jest.fn();
    const res = await withCronLock('job1', fn);
    expect(fn).not.toHaveBeenCalled();
    expect(res).toEqual({ skipped: true });
  });

  it('Redis hatasında fail-open — fn yine çalışır (tek-instance varsayımı)', async () => {
    mockSet.mockRejectedValueOnce(new Error('redis down'));
    const fn = jest.fn().mockResolvedValue('ran');
    const res = await withCronLock('job1', fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(res).toBe('ran');
  });

  it('özel ttlMs SET çağrısına geçer', async () => {
    mockSet.mockResolvedValueOnce('OK');
    await withCronLock('job2', jest.fn(), { ttlMs: 5000 });
    expect(mockSet).toHaveBeenCalledWith('cron-lock:job2', expect.any(String), 'PX', 5000, 'NX');
  });
});
