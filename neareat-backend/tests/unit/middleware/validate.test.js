'use strict';

const { z } = require('zod');
const validate = require('../../../src/middleware/validate');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

const schema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter olmalı'),
  age: z.coerce.number().int().min(0),
});

describe('validate middleware', () => {
  let res; let next;
  beforeEach(() => { res = makeRes(); next = jest.fn(); });

  it('geçerli body → next çağrılır ve parse edilmiş veri req.body olur', () => {
    const req = { body: { name: 'Ada', age: '30' } };
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Ada', age: 30 }); // age coerce edildi
  });

  it('geçersiz body → 400 { error, details }, controller çağrılmaz', () => {
    const req = { body: { name: 'A' } };
    validate(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error).toBe('İsim en az 2 karakter olmalı');
    expect(Array.isArray(payload.details)).toBe(true);
    expect(payload.details.length).toBeGreaterThan(0);
  });

  it('body yoksa boş nesne gibi doğrulanır (zorunlu alanlar → 400)', () => {
    const req = {};
    validate(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
