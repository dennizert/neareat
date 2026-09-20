/**
 * Oturum politikası — A01/A02/A04 (issue #451).
 *
 * Bu kararlar yanlış olduğunda hata VERMEZ, sessizce yanlış davranır: kullanıcı
 * sebepsiz çıkış yapmış olur. Bu yüzden doğrudan test ediliyorlar.
 */
import {
  isAuthInvalid,
  isTransientFailure,
  shouldClearCredential,
  shouldRetryAuthProbe,
  isCurrentSession,
} from '../../utils/sessionPolicy';

const httpError = (status: number) => ({ response: { status } });
const networkError = { message: 'Network Error' };
const timeoutError = { code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' };

describe('isAuthInvalid', () => {
  it.each([[401], [403]])('%i → kimlik açıkça reddedildi', (s) => {
    expect(isAuthInvalid(httpError(s))).toBe(true);
  });

  // "Bilmiyoruz" ile "geçersiz" aynı şey değil. A04'ün özü bu ayrım.
  it.each([
    ['ağ hatası', networkError],
    ['zaman aşımı', timeoutError],
    ['500', httpError(500)],
    ['502', httpError(502)],
    ['503', httpError(503)],
    ['404', httpError(404)],
    ['undefined', undefined],
  ])('%s → kimlik geçersizliği KANITI DEĞİL', (_l, err) => {
    expect(isAuthInvalid(err)).toBe(false);
  });
});

describe('isTransientFailure', () => {
  it.each([
    ['ağ hatası (yanıt yok)', networkError],
    ['zaman aşımı', timeoutError],
    ['500', httpError(500)],
    ['503', httpError(503)],
  ])('%s → geçici', (_l, err) => {
    expect(isTransientFailure(err)).toBe(true);
  });

  it.each([
    ['401', httpError(401)],
    ['403', httpError(403)],
    ['404', httpError(404)],
    ['400', httpError(400)],
  ])('%s → geçici DEĞİL (yeniden denemek düzeltmez)', (_l, err) => {
    expect(isTransientFailure(err)).toBe(false);
  });
});

describe('shouldClearCredential', () => {
  // ASIL HATA (A04): eskiden `catch { clearStoredToken() }` idi — hepsi siliyordu.
  it('T1 401 → silinir', () => expect(shouldClearCredential(httpError(401))).toBe(true));
  it('T2 403 → silinir', () => expect(shouldClearCredential(httpError(403))).toBe(true));
  it('T3 ağ hatası → SİLİNMEZ', () => expect(shouldClearCredential(networkError)).toBe(false));
  it('T4 zaman aşımı → SİLİNMEZ', () => expect(shouldClearCredential(timeoutError)).toBe(false));
  it.each([[500], [502], [503]])('T5 %i → SİLİNMEZ', (s) => {
    expect(shouldClearCredential(httpError(s))).toBe(false);
  });
});

describe('shouldRetryAuthProbe', () => {
  it('T6 geçici hata, deneme hakkı var → yeniden dene', () => {
    expect(shouldRetryAuthProbe(networkError, 1, 3)).toBe(true);
    expect(shouldRetryAuthProbe(timeoutError, 2, 3)).toBe(true);
  });

  it('son denemede durur', () => {
    expect(shouldRetryAuthProbe(networkError, 3, 3)).toBe(false);
  });

  it('kalıcı hatada yeniden denemez', () => {
    expect(shouldRetryAuthProbe(httpError(401), 1, 3)).toBe(false);
    expect(shouldRetryAuthProbe(httpError(404), 1, 3)).toBe(false);
  });
});

describe('isCurrentSession', () => {
  it('T7 eski nesil → güncel değil (çıkış YAPILMAZ)', () => {
    expect(isCurrentSession(1, 2)).toBe(false);
  });

  it('T8 aynı nesil → güncel (çıkış YAPILIR)', () => {
    expect(isCurrentSession(2, 2)).toBe(true);
  });

  // Damgasız istek interceptor'dan geçmemiştir. Güvenli varsayılan GÜNCEL saymak:
  // kaçırılmış bir çıkış, kullanıcıyı çalışmayan bir arayüzde bırakır ve bu,
  // yanlış kullanıcının çıkarılmasından daha kötüdür.
  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('T9 damgasız istek (%s) → güvenli varsayılan: güncel', (_l, v) => {
    expect(isCurrentSession(v as any, 5)).toBe(true);
  });

  it('nesil ilerledikçe eski damgalar geçersizleşir', () => {
    expect(isCurrentSession(3, 4)).toBe(false);
    expect(isCurrentSession(4, 4)).toBe(true);
  });
});
