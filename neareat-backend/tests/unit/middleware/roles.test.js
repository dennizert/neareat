'use strict';

const { requireAdmin, requireRestaurant } = require('../../../src/middleware/roles');

function makeReq(role) {
  return { user: { role } };
}

describe('requireAdmin middleware', () => {
  let res;
  let next;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('returns 403 with the correct error message when role is USER', () => {
    requireAdmin(makeReq('USER'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin yetkisi gerekli' });
  });

  it('returns 403 when role is RESTAURANT', () => {
    requireAdmin(makeReq('RESTAURANT'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin yetkisi gerekli' });
  });

  it('calls next() and does NOT call res.status when role is ADMIN', () => {
    requireAdmin(makeReq('ADMIN'), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('does not call next() when role is USER', () => {
    requireAdmin(makeReq('USER'), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not call next() when role is RESTAURANT', () => {
    requireAdmin(makeReq('RESTAURANT'), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns the response (chained res) so the request terminates for non-admins', () => {
    const result = requireAdmin(makeReq('USER'), res, next);
    // The middleware returns the result of res.status(...).json(...)
    // which equals res (due to mockReturnThis) — not undefined
    expect(result).toBeDefined();
    expect(result).toBe(res);
  });
});

describe('requireRestaurant middleware', () => {
  let res;
  let next;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('returns 403 with the correct error message when role is USER', () => {
    requireRestaurant(makeReq('USER'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Restoran hesabı gerekli' });
  });

  it('returns 403 with the correct error message when role is ADMIN', () => {
    requireRestaurant(makeReq('ADMIN'), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Restoran hesabı gerekli' });
  });

  it('calls next() when role is RESTAURANT', () => {
    requireRestaurant(makeReq('RESTAURANT'), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('does not call next() when role is USER', () => {
    requireRestaurant(makeReq('USER'), res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not call next() when role is ADMIN', () => {
    requireRestaurant(makeReq('ADMIN'), res, next);
    expect(next).not.toHaveBeenCalled();
  });
});
