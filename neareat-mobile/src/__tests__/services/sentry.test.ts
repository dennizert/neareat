import { __test, initSentry, captureException, wrapWithSentry } from '../../services/sentry';

// expo-constants extra.sentryDsn boş (app.json) → DSN yok → no-op beklenir.
describe('sentry wrapper (S14-M3)', () => {
  it('DSN yokken init/capture no-op, hata fırlatmaz', () => {
    expect(__test.dsn()).toBeNull();
    expect(() => initSentry()).not.toThrow();
    expect(() => captureException(new Error('x'))).not.toThrow();
  });

  it('DSN yokken wrapWithSentry bileşeni olduğu gibi döndürür', () => {
    const Comp = () => null;
    expect(wrapWithSentry(Comp)).toBe(Comp);
  });

  it('scrub şifre/token içeren extra alanlarını maskeler', () => {
    const ev = __test.scrub({ extra: { password: 'p', token: 't', city: 'Istanbul' } });
    expect(ev.extra.password).toBe('[redacted]');
    expect(ev.extra.token).toBe('[redacted]');
    expect(ev.extra.city).toBe('Istanbul');
  });

  it('scrub request header alanlarini siler', () => {
    const ev = __test.scrub({ request: { headers: { Authorization: 'Bearer x' } } });
    expect(ev.request.headers).toBeUndefined();
  });
});
