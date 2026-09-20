/**
 * #430 — api.ts: axios instance'ının kurduğu interceptor mantığı. Bu dosya
 * mobil-backend sözleşmesinin en kritik parçası: token enjeksiyonu, oturum
 * neslini damgalayan A02 401-eşleşme mantığı ve hata mesajı eşlemesi.
 *
 * axios.create mock'lanarak gerçek instance yerine interceptor callback'lerini
 * yakalayan sahte bir obje döndürülür — böylece api.ts'in KENDİ interceptor
 * fonksiyonları doğrudan çağrılıp test edilebilir.
 */
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: { getState: jest.fn() },
}));

import { setTokenGetter, getToken, getApiErrorMessage } from '../../services/api';

const axios = require('axios');
const fakeInstance = axios.create.mock.results[0].value;
const mockRequestUse = fakeInstance.interceptors.request.use as jest.Mock;
const mockResponseUse = fakeInstance.interceptors.response.use as jest.Mock;

const { useAuthStore } = require('../../store/authStore');
const mockedGetState = (useAuthStore.getState as jest.Mock);

beforeEach(() => jest.clearAllMocks());

describe('getToken / setTokenGetter', () => {
  it('getter ayarlanmamışsa null döner', async () => {
    // Bu test dosyasında modül zaten import edildi; başka testler getter set etmiş
    // olabileceğinden burada açıkça null'a resetliyoruz.
    setTokenGetter(null as any);
    await expect(getToken()).resolves.toBeNull();
  });

  it('getter ayarlandıysa onun döndürdüğü token’ı verir', async () => {
    setTokenGetter(async () => 'tok-123');
    await expect(getToken()).resolves.toBe('tok-123');
  });
});

describe('request interceptor — token enjeksiyonu + oturum damgası (A02)', () => {
  const requestInterceptor = mockRequestUse.mock.calls[0][0];

  it('mevcut sessionId’yi config.__sessionId olarak damgalar', async () => {
    mockedGetState.mockReturnValue({ sessionId: 7 });
    setTokenGetter(null as any);

    const config: any = { headers: {} };
    const result = await requestInterceptor(config);

    expect(result.__sessionId).toBe(7);
  });

  it('token getter varsa Authorization header’ına ekler', async () => {
    mockedGetState.mockReturnValue({ sessionId: 1 });
    setTokenGetter(async () => 'gid-1');

    const config: any = { headers: {} };
    const result = await requestInterceptor(config);

    expect(result.headers.Authorization).toBe('Bearer gid-1');
  });

  it('token getter null dönerse Authorization header eklenmez', async () => {
    mockedGetState.mockReturnValue({ sessionId: 1 });
    setTokenGetter(async () => null);

    const config: any = { headers: {} };
    const result = await requestInterceptor(config);

    expect(result.headers.Authorization).toBeUndefined();
  });
});

describe('getApiErrorMessage', () => {
  it('5xx için genel sunucu hatası mesajı', () => {
    expect(getApiErrorMessage({ response: { status: 500, data: {} } })).toBe(
      'Sunucuda bir sorun oluştu. Lütfen biraz sonra tekrar dene.',
    );
  });

  it('EMAIL_NOT_VERIFIED için özel yönlendirme mesajı', () => {
    const msg = getApiErrorMessage({ response: { status: 403, data: { code: 'EMAIL_NOT_VERIFIED' } } });
    expect(msg).toContain('e-posta');
  });

  it('4xx backend mesajını tercih eder', () => {
    const msg = getApiErrorMessage({ response: { status: 400, data: { error: 'Geçersiz istek' } } });
    expect(msg).toBe('Geçersiz istek');
  });

  it('4xx backend mesajı yoksa jenerik mesaja düşer', () => {
    const msg = getApiErrorMessage({ response: { status: 400, data: {} } });
    expect(msg).toBe('Bir şeyler ters gitti. Lütfen tekrar dene.');
  });

  it('timeout (ECONNABORTED) için özel mesaj', () => {
    expect(getApiErrorMessage({ code: 'ECONNABORTED' })).toBe('İstek zaman aşımına uğradı. Bağlantını kontrol edip tekrar dene.');
  });

  it('response yoksa ve timeout değilse bağlantı hatası mesajı', () => {
    expect(getApiErrorMessage({})).toBe('Bağlantı kurulamadı. İnternet bağlantını kontrol et.');
  });
});

describe('response interceptor — A02 oturum-neslikli 401 eşleşmesi', () => {
  const responseInterceptor = mockResponseUse.mock.calls[0]; // [onFulfilled, onRejected]
  const onRejected = responseInterceptor[1];
  const mockLogout = jest.fn().mockResolvedValue(undefined);

  it('başarı yolu (onFulfilled) response’u olduğu gibi geçirir', () => {
    const onFulfilled = responseInterceptor[0];
    const response = { data: 'ok' };
    expect(onFulfilled(response)).toBe(response);
  });

  it('güncel oturumdan gelen 401 → logout tetikler ve userMessage ekler', async () => {
    mockedGetState.mockReturnValue({ user: { id: 'u1' }, sessionId: 5, logout: mockLogout });
    const error: any = { response: { status: 401 }, config: { __sessionId: 5 } };

    await expect(onRejected(error)).rejects.toBe(error);

    expect(mockLogout).toHaveBeenCalled();
    expect(error.userMessage).toBe('Oturumun sona erdi. Lütfen tekrar giriş yap.');
  });

  it('ESKİ oturumdan gelen 401 (araya çıkış/giriş girmiş) logout TETİKLEMEZ', async () => {
    // A02: sessionId isteğin başladığı anki nesil (5); şu an oturum 6'ya geçmiş.
    mockedGetState.mockReturnValue({ user: { id: 'u2' }, sessionId: 6, logout: mockLogout });
    const error: any = { response: { status: 401 }, config: { __sessionId: 5 } };

    await expect(onRejected(error)).rejects.toBe(error);

    expect(mockLogout).not.toHaveBeenCalled();
    expect(error.userMessage).not.toBe('Oturumun sona erdi. Lütfen tekrar giriş yap.');
  });

  it('giriş yapılmamışken 401 (ör. yanlış şifre) logout tetiklemez, backend mesajı korunur', async () => {
    mockedGetState.mockReturnValue({ user: null, sessionId: 1, logout: mockLogout });
    const error: any = { response: { status: 401, data: { error: 'E-posta veya şifre hatalı' } }, config: {} };

    await expect(onRejected(error)).rejects.toBe(error);

    expect(mockLogout).not.toHaveBeenCalled();
    expect(error.userMessage).toBe('E-posta veya şifre hatalı');
  });
});
