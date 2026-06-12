'use strict';

// @sentry/node mock — gerçek ağ/init olmadan davranışı doğrulamak için.
const mockInit = jest.fn();
const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();
jest.mock('@sentry/node', () => ({
  init: mockInit,
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
}));

const ORIG_DSN = process.env.SENTRY_DSN;

afterEach(() => {
  if (ORIG_DSN === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = ORIG_DSN;
  jest.clearAllMocks();
});

function freshRequire() {
  jest.resetModules();
  return require('../../../src/services/sentry');
}

describe('sentry servisi', () => {
  it('SENTRY_DSN yokken no-op (init/capture çağrılmaz)', () => {
    delete process.env.SENTRY_DSN;
    const sentry = freshRequire();
    expect(sentry.getSentry()).toBeNull();
    sentry.captureException(new Error('x'), { a: 1 });
    sentry.captureSecurityEvent('AUTH_FAILED', { ip: '1.2.3.4' });
    expect(mockInit).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('SENTRY_DSN varken init edilir ve olaylar iletilir', () => {
    process.env.SENTRY_DSN = 'https://abc@o1.ingest.sentry.io/1';
    const sentry = freshRequire();
    sentry.captureSecurityEvent('IAP_REJECTED', { userId: 'u1' });
    sentry.captureException(new Error('boom'), { requestId: 'r1' });
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockCaptureMessage).toHaveBeenCalledWith('[SECURITY] IAP_REJECTED', expect.objectContaining({ level: 'warning' }));
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it('scrub şifre/token alanlarını maskeler', () => {
    const sentry = freshRequire();
    const out = sentry.scrub({ email: 'a@b.com', password: 'secret', purchaseToken: 'tok', ip: '1.1.1.1' });
    expect(out.password).toBe('[redacted]');
    expect(out.purchaseToken).toBe('[redacted]');
    expect(out.email).toBe('a@b.com');
    expect(out.ip).toBe('1.1.1.1');
  });
});
