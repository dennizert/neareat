'use strict';

const requestId = require('../../../src/middleware/requestId');

/**
 * Helper: returns a minimal req/res pair and a jest.fn() next.
 * headers_res is the backing store for res.setHeader so we can
 * inspect what was set after the middleware runs.
 */
function makeReqRes(headers = {}) {
  const req = { headers, id: undefined };
  const headers_res = {};
  const res = {
    setHeader: (k, v) => { headers_res[k] = v; },
    _headers: headers_res,
  };
  const next = jest.fn();
  return { req, res, next, headers_res };
}

// UUID v4 canonical format: 8-4-4-4-12 hex chars separated by hyphens
// The prompt specifies a looser regex — also accept it
const UUID_LOOSE_RE = /^[0-9a-f-]{36}$/i;

describe('requestId middleware', () => {
  it('calls next() exactly once', () => {
    const { req, res, next } = makeReqRes();
    requestId(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets the X-Request-ID response header', () => {
    const { req, res, next, headers_res } = makeReqRes();
    requestId(req, res, next);
    expect(headers_res).toHaveProperty('X-Request-ID');
    expect(typeof headers_res['X-Request-ID']).toBe('string');
  });

  it('generates a UUID when no x-request-id header is provided', () => {
    const { req, res, next, headers_res } = makeReqRes();
    requestId(req, res, next);
    expect(req.id).toMatch(UUID_LOOSE_RE);
    expect(headers_res['X-Request-ID']).toMatch(UUID_LOOSE_RE);
  });

  it('uses the incoming x-request-id header when it is a string ≤ 64 chars', () => {
    const incomingId = 'my-custom-request-id-12345';
    const { req, res, next, headers_res } = makeReqRes({ 'x-request-id': incomingId });
    requestId(req, res, next);
    expect(req.id).toBe(incomingId);
    expect(headers_res['X-Request-ID']).toBe(incomingId);
  });

  it('uses the x-request-id header when it is exactly 64 characters', () => {
    const exactly64 = 'a'.repeat(64);
    const { req, res, next, headers_res } = makeReqRes({ 'x-request-id': exactly64 });
    requestId(req, res, next);
    expect(req.id).toBe(exactly64);
    expect(headers_res['X-Request-ID']).toBe(exactly64);
  });

  it('ignores x-request-id header when it is 65 characters and generates a UUID instead', () => {
    const tooLong = 'b'.repeat(65);
    const { req, res, next, headers_res } = makeReqRes({ 'x-request-id': tooLong });
    requestId(req, res, next);
    expect(req.id).not.toBe(tooLong);
    expect(req.id).toMatch(UUID_LOOSE_RE);
    expect(headers_res['X-Request-ID']).toMatch(UUID_LOOSE_RE);
  });

  it('generates a UUID when x-request-id is an array (not a string)', () => {
    const { req, res, next, headers_res } = makeReqRes({ 'x-request-id': ['id-a', 'id-b'] });
    requestId(req, res, next);
    expect(req.id).toMatch(UUID_LOOSE_RE);
    expect(headers_res['X-Request-ID']).toMatch(UUID_LOOSE_RE);
  });

  it('generates a UUID when x-request-id is a number', () => {
    const { req, res, next, headers_res } = makeReqRes({ 'x-request-id': 42 });
    requestId(req, res, next);
    expect(req.id).toMatch(UUID_LOOSE_RE);
    expect(headers_res['X-Request-ID']).toMatch(UUID_LOOSE_RE);
  });

  it('sets req.id to the same value as the X-Request-ID response header', () => {
    const { req, res, next, headers_res } = makeReqRes();
    requestId(req, res, next);
    expect(req.id).toBe(headers_res['X-Request-ID']);
  });

  it('sets req.id equal to the response header when using an incoming id', () => {
    const incomingId = 'consistent-check-id';
    const { req, res, next, headers_res } = makeReqRes({ 'x-request-id': incomingId });
    requestId(req, res, next);
    expect(req.id).toBe(headers_res['X-Request-ID']);
  });

  it('generates different UUIDs on successive calls without an incoming header', () => {
    const first = makeReqRes();
    const second = makeReqRes();
    requestId(first.req, first.res, first.next);
    requestId(second.req, second.res, second.next);
    // While technically UUIDs could collide, the probability is negligible
    expect(first.req.id).not.toBe(second.req.id);
  });
});
