import { trackEvent, setAnalyticsSink, stripPii, ANALYTICS_EVENTS } from '../../services/analytics';

afterEach(() => setAnalyticsSink(null));

describe('analytics (S14-M5)', () => {
  it('sink yokken trackEvent no-op (hata fırlatmaz)', () => {
    expect(() => trackEvent('x', { a: 1 })).not.toThrow();
  });

  it('sink takılıysa olay + temizlenmiş props ile çağrılır', () => {
    const sink = jest.fn();
    setAnalyticsSink(sink);
    trackEvent(ANALYTICS_EVENTS.PAYWALL_SHOWN, { role: 'user', email: 'a@b.com' });
    expect(sink).toHaveBeenCalledWith('paywall_shown', { role: 'user' }); // email ayıklandı
  });

  it('sink hatası UX akışını bozmaz', () => {
    setAnalyticsSink(() => { throw new Error('boom'); });
    expect(() => trackEvent('x')).not.toThrow();
  });

  it('stripPii PII anahtarlarını ayıklar, diğerlerini korur', () => {
    expect(stripPii({ placeId: 'p1', email: 'a@b.com', phone: '5xx', guestCount: 2 }))
      .toEqual({ placeId: 'p1', guestCount: 2 });
  });
});
