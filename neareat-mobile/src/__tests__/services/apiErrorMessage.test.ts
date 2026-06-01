import { getApiErrorMessage } from '../../services/api';

describe('getApiErrorMessage', () => {
  it('5xx → sunucu hatası mesajı', () => {
    const msg = getApiErrorMessage({ response: { status: 500, data: {} } });
    expect(msg).toMatch(/Sunucuda bir sorun/);
  });

  it('4xx → sunucunun verdiği Türkçe mesajı kullanır', () => {
    const msg = getApiErrorMessage({ response: { status: 401, data: { error: 'E-posta veya şifre hatalı' } } });
    expect(msg).toBe('E-posta veya şifre hatalı');
  });

  it('4xx (sunucu mesajı yok) → genel mesaj', () => {
    const msg = getApiErrorMessage({ response: { status: 400, data: {} } });
    expect(msg).toMatch(/Bir şeyler ters gitti/);
  });

  it('timeout (ECONNABORTED) → zaman aşımı mesajı', () => {
    const msg = getApiErrorMessage({ code: 'ECONNABORTED' });
    expect(msg).toMatch(/zaman aşımına/);
  });

  it('response yok (ağ hatası) → bağlantı mesajı', () => {
    const msg = getApiErrorMessage({ message: 'Network Error' });
    expect(msg).toMatch(/Bağlantı kurulamadı/);
  });
});
