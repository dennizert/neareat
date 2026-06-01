'use strict';

jest.mock('../../../src/services/redis', () => ({ getRedis: jest.fn() }));
jest.mock('../../../src/middleware/securityLogger', () => ({
  logSecurityEvent: jest.fn(),
  EVENTS: { RATE_LIMIT_HIT: 'RATE_LIMIT_HIT' },
}));

const { getRedis } = require('../../../src/services/redis');
const aiRateLimit = require('../../../src/middleware/aiRateLimit');

function makeRes() {
  return {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('aiRateLimit', () => {
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = makeRes();
    next = jest.fn();
  });

  it('kullanıcı yoksa limit uygulanmaz (next)', async () => {
    await aiRateLimit({}, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('limit altında next() çağırır', async () => {
    getRedis.mockReturnValue({
      incr: jest.fn().mockResolvedValue(1),
      pexpire: jest.fn().mockResolvedValue(1),
    });

    await aiRateLimit({ user: { id: 'u1' } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(429);
  });

  it('limit aşılınca 429 döner, next() çağrılmaz', async () => {
    getRedis.mockReturnValue({
      incr: jest.fn().mockResolvedValue(11), // varsayılan limit 10
      pexpire: jest.fn(),
    });

    await aiRateLimit({ user: { id: 'u1' }, ip: '1.2.3.4', path: '/recommendations' }, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('redis hatasında fail open (next)', async () => {
    getRedis.mockReturnValue({
      incr: jest.fn().mockRejectedValue(new Error('redis down')),
      pexpire: jest.fn(),
    });

    await aiRateLimit({ user: { id: 'u1' } }, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(429);
  });
});
