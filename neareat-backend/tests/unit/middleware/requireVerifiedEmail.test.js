'use strict';

const requireVerifiedEmail = require('../../../src/middleware/requireVerifiedEmail');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('requireVerifiedEmail', () => {
  const ORIG = process.env.ENFORCE_EMAIL_VERIFICATION;
  let res;
  let next;

  beforeEach(() => {
    res = makeRes();
    next = jest.fn();
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.ENFORCE_EMAIL_VERIFICATION;
    else process.env.ENFORCE_EMAIL_VERIFICATION = ORIG;
  });

  it('flag kapalıyken doğrulanmamış kullanıcıyı bile geçirir (no-op)', () => {
    delete process.env.ENFORCE_EMAIL_VERIFICATION;
    requireVerifiedEmail({ user: { emailVerified: false } }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('flag açık + emailVerified=true → next', () => {
    process.env.ENFORCE_EMAIL_VERIFICATION = 'true';
    requireVerifiedEmail({ user: { emailVerified: true } }, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('flag açık + emailVerified=false → 403 EMAIL_NOT_VERIFIED', () => {
    process.env.ENFORCE_EMAIL_VERIFICATION = 'true';
    requireVerifiedEmail({ user: { emailVerified: false } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }),
    );
  });
});
