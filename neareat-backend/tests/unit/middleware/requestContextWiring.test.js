'use strict';

/**
 * requestId middleware'inin istek bağlamını kurduğunu ve securityLogger'ın bu bağlamı
 * devraldığını doğrular (S21-2).
 *
 * Bu, S21-2'nin asıl iddiasının testi: servis imzalarına `req` eklemeden, çağrı zincirinin
 * herhangi bir derinliğinden requestId'ye erişilebilmeli.
 */

const requestIdMiddleware = require('../../../src/middleware/requestId');
const { getRequestId } = require('../../../src/utils/requestContext');
const { logSecurityEvent, EVENTS } = require('../../../src/middleware/securityLogger');

function fakeReqRes(headers = {}) {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; } };
  return [{ headers }, res];
}

describe('requestId middleware — bağlam kurulumu', () => {
  it('next() bağlam İÇİNDE çağrılır (zincir bağlamı devralır)', () => {
    const [req, res] = fakeReqRes();
    let seen = null;
    requestIdMiddleware(req, res, () => {
      seen = getRequestId();
    });
    expect(seen).toBe(req.id);
    expect(seen).toEqual(expect.any(String));
  });

  it('client X-Request-ID gönderirse bağlama o değer girer', () => {
    const [req, res] = fakeReqRes({ 'x-request-id': 'client-supplied-id' });
    let seen = null;
    requestIdMiddleware(req, res, () => {
      seen = getRequestId();
    });
    expect(seen).toBe('client-supplied-id');
    expect(res.headers['X-Request-ID']).toBe('client-supplied-id');
  });

  it('bağlam derin async çağrı zincirinde korunur', async () => {
    const [req, res] = fakeReqRes();

    // Servis katmanını taklit eder: imzasında `req` YOK, yine de kimliğe erişir.
    async function deepService() {
      await new Promise((r) => setTimeout(r, 1));
      return getRequestId();
    }

    let result = null;
    await new Promise((resolve) => {
      requestIdMiddleware(req, res, async () => {
        result = await deepService();
        resolve();
      });
    });

    expect(result).toBe(req.id);
  });

  it('istek dışında bağlam yoktur (sızıntı yok)', () => {
    const [req, res] = fakeReqRes();
    requestIdMiddleware(req, res, () => {});
    expect(getRequestId()).toBeNull();
  });
});

describe('securityLogger — bağlamdan requestId zenginleştirmesi', () => {
  let warnSpy;
  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warnSpy.mockRestore());

  it('istek bağlamı içinde requestId otomatik eklenir', () => {
    const [req, res] = fakeReqRes({ 'x-request-id': 'sec-req-1' });
    requestIdMiddleware(req, res, () => {
      logSecurityEvent(EVENTS.AUTH_FAILED, { ip: '1.2.3.4' });
    });
    const parsed = JSON.parse(warnSpy.mock.calls[0][1]);
    expect(parsed.requestId).toBe('sec-req-1');
    expect(parsed.ip).toBe('1.2.3.4');
  });

  it('çağıranın açık requestId değeri bağlamdakini ezer', () => {
    const [req, res] = fakeReqRes({ 'x-request-id': 'ctx-id' });
    requestIdMiddleware(req, res, () => {
      logSecurityEvent(EVENTS.AUTH_FAILED, { requestId: 'explicit-id' });
    });
    const parsed = JSON.parse(warnSpy.mock.calls[0][1]);
    expect(parsed.requestId).toBe('explicit-id');
  });

  it('bağlam yokken çıktı biçimi bozulmaz (requestId alanı hiç eklenmez)', () => {
    logSecurityEvent(EVENTS.SEED_BLOCKED, { ip: '10.0.0.1' });
    const parsed = JSON.parse(warnSpy.mock.calls[0][1]);
    expect(parsed).not.toHaveProperty('requestId');
    expect(parsed.event).toBe('SEED_BLOCKED');
    expect(warnSpy.mock.calls[0][0]).toBe('[SECURITY]');
  });
});
