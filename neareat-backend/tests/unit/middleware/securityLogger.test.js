'use strict';

const { logSecurityEvent, EVENTS } = require('../../../src/middleware/securityLogger');

describe('EVENTS constants', () => {
  it('EVENTS.AUTH_FAILED equals "AUTH_FAILED"', () => {
    expect(EVENTS.AUTH_FAILED).toBe('AUTH_FAILED');
  });

  it('EVENTS.SUSPENDED_ACCESS equals "SUSPENDED_ACCESS"', () => {
    expect(EVENTS.SUSPENDED_ACCESS).toBe('SUSPENDED_ACCESS');
  });

  it('EVENTS.SEED_BLOCKED equals "SEED_BLOCKED"', () => {
    expect(EVENTS.SEED_BLOCKED).toBe('SEED_BLOCKED');
  });

  it('EVENTS.RATE_LIMIT_HIT equals "RATE_LIMIT_HIT"', () => {
    expect(EVENTS.RATE_LIMIT_HIT).toBe('RATE_LIMIT_HIT');
  });

  it('all 4 expected event constants are defined', () => {
    const expectedKeys = ['AUTH_FAILED', 'SUSPENDED_ACCESS', 'SEED_BLOCKED', 'RATE_LIMIT_HIT'];
    for (const key of expectedKeys) {
      expect(EVENTS).toHaveProperty(key);
      expect(typeof EVENTS[key]).toBe('string');
    }
  });
});

describe('logSecurityEvent', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('calls console.warn exactly once', () => {
    logSecurityEvent(EVENTS.AUTH_FAILED, { ip: '127.0.0.1' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('passes [SECURITY] as the first argument to console.warn', () => {
    logSecurityEvent(EVENTS.AUTH_FAILED);
    expect(warnSpy.mock.calls[0][0]).toBe('[SECURITY]');
  });

  it('logged string contains the event name', () => {
    logSecurityEvent(EVENTS.AUTH_FAILED, { ip: '1.2.3.4' });
    const logged = warnSpy.mock.calls[0][1];
    expect(logged).toContain('AUTH_FAILED');
  });

  it('logged string contains the "timestamp" key', () => {
    logSecurityEvent(EVENTS.SUSPENDED_ACCESS, {});
    const logged = warnSpy.mock.calls[0][1];
    expect(logged).toContain('timestamp');
  });

  it('logged string contains provided ip detail', () => {
    logSecurityEvent(EVENTS.RATE_LIMIT_HIT, { ip: '192.168.1.1' });
    const logged = warnSpy.mock.calls[0][1];
    expect(logged).toContain('192.168.1.1');
  });

  it('logged string contains provided requestId detail', () => {
    logSecurityEvent(EVENTS.AUTH_FAILED, { requestId: 'req-abc-123' });
    const logged = warnSpy.mock.calls[0][1];
    expect(logged).toContain('req-abc-123');
  });

  it('logged output is valid JSON', () => {
    logSecurityEvent(EVENTS.SEED_BLOCKED, { ip: '10.0.0.1', userId: 'u-99' });
    const logged = warnSpy.mock.calls[0][1];
    expect(() => JSON.parse(logged)).not.toThrow();
  });

  it('parsed JSON contains the correct event field', () => {
    logSecurityEvent(EVENTS.SEED_BLOCKED, { ip: '10.0.0.1' });
    const parsed = JSON.parse(warnSpy.mock.calls[0][1]);
    expect(parsed.event).toBe('SEED_BLOCKED');
  });

  it('parsed JSON contains a valid ISO timestamp', () => {
    logSecurityEvent(EVENTS.AUTH_FAILED, {});
    const parsed = JSON.parse(warnSpy.mock.calls[0][1]);
    expect(typeof parsed.timestamp).toBe('string');
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
  });

  it('does not throw when called with no details argument', () => {
    expect(() => logSecurityEvent(EVENTS.AUTH_FAILED)).not.toThrow();
  });

  it('does not throw when called with an empty details object', () => {
    expect(() => logSecurityEvent(EVENTS.SUSPENDED_ACCESS, {})).not.toThrow();
  });

  it('spreads extra detail fields directly onto the log entry', () => {
    logSecurityEvent(EVENTS.RATE_LIMIT_HIT, { ip: '5.5.5.5', path: '/api/login' });
    const parsed = JSON.parse(warnSpy.mock.calls[0][1]);
    expect(parsed.ip).toBe('5.5.5.5');
    expect(parsed.path).toBe('/api/login');
  });
});
