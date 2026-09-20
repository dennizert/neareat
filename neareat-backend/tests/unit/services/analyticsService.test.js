'use strict';

/**
 * analyticsService — mobil sink'in yazdığı funnel event'lerinin backend'e kalıcı
 * yazılması (S14-M5 devamı, #481). Prisma mock'lu.
 *
 * Açık: `setAnalyticsSink` hiç çağrılmadığı için 5 funnel event'i kodda üretiliyor
 * ve hiçbir yere gitmiyordu. Bu servis kendi Postgres'e yazan sink'in backend tarafı.
 */

const mockPrisma = {
  analyticsEvent: { create: jest.fn(), groupBy: jest.fn() },
};
jest.mock('../../../src/utils/prisma', () => mockPrisma);

const { recordEvent, getFunnelSummary, sanitizeProps } = require('../../../src/services/analyticsService');

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.analyticsEvent.create.mockResolvedValue({ id: 'ev-1' });
});

describe('sanitizeProps', () => {
  it('normal değerleri (string/number/boolean/null) korur', () => {
    expect(sanitizeProps({ placeId: 'p1', guestCount: 2, ok: true, note: null }))
      .toEqual({ placeId: 'p1', guestCount: 2, ok: true, note: null });
  });

  // DERİNLEMESİNE SAVUNMA: mobil zaten stripPii uyguluyor ama backend'e güvenmemek
  // gerekir — client bir bug ile filtreyi atlayabilir.
  it.each([
    ['email'], ['userEmail'], ['password'], ['phone'], ['token'],
    ['authorization'], ['address'],
  ])('PII anahtarını (%s) ATAR', (key) => {
    const props = sanitizeProps({ [key]: 'hassas-deger', placeId: 'p1' });
    expect(props).not.toHaveProperty(key);
    expect(props.placeId).toBe('p1');
  });

  it('nesne/dizi değerleri sessizce atlar (hata fırlatmaz)', () => {
    expect(sanitizeProps({ nested: { a: 1 }, list: [1, 2], placeId: 'p1' }))
      .toEqual({ placeId: 'p1' });
  });

  it('aşırı uzun string değeri kısaltır', () => {
    const long = 'x'.repeat(1000);
    expect(sanitizeProps({ note: long }).note.length).toBe(500);
  });

  it('çok fazla anahtar varsa ilk 20\'yi alır (DoS/kötüye kullanım freni)', () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitizeProps(many)).length).toBe(20);
  });

  it.each([
    ['undefined', undefined], ['null', null], ['string', 'x'], ['dizi', [1, 2]],
  ])('%s girdi → null döner', (_l, input) => {
    expect(sanitizeProps(input)).toBeNull();
  });

  it('yalnızca PII/geçersiz alanlar kalırsa null döner (boş nesne değil)', () => {
    expect(sanitizeProps({ email: 'a@b.com' })).toBeNull();
  });
});

describe('recordEvent', () => {
  it('giriş yapmış kullanıcının event\'i userId ile kaydedilir', async () => {
    await recordEvent({ userId: 'u1', name: 'paywall_shown', props: { role: 'user' } });
    expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith({
      data: { userId: 'u1', name: 'paywall_shown', props: { role: 'user' } },
      select: { id: true },
    });
  });

  // ASIL SENARYO: optionalAuth ile anonim/misafir kullanıcı da event üretebilmeli.
  it('userId yoksa (anonim) null ile kaydedilir, hata FIRLATMAZ', async () => {
    await recordEvent({ userId: null, name: 'screen_view' });
    expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith({
      data: { userId: null, name: 'screen_view', props: null },
      select: { id: true },
    });
  });

  it('name boşsa 400 HttpError fırlatır, DB\'ye yazmaz', async () => {
    await expect(recordEvent({ name: '' })).rejects.toMatchObject({ status: 400 });
    expect(mockPrisma.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it('name yalnızca boşluksa 400 (trim sonrası boş)', async () => {
    await expect(recordEvent({ name: '   ' })).rejects.toMatchObject({ status: 400 });
  });

  it('props PII içeriyorsa sanitizeProps ile temizlenmiş hâli yazılır', async () => {
    await recordEvent({ userId: 'u1', name: 'x', props: { email: 'a@b.com', placeId: 'p1' } });
    expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ props: { placeId: 'p1' } }) }),
    );
  });
});

describe('getFunnelSummary', () => {
  it('event adına göre gruplu sayım döner', async () => {
    mockPrisma.analyticsEvent.groupBy.mockResolvedValue([
      { name: 'restaurant_detail_open', _count: { _all: 40 } },
      { name: 'reservation_started', _count: { _all: 12 } },
      { name: 'reservation_completed', _count: { _all: 9 } },
    ]);

    const result = await getFunnelSummary({ days: 7 });

    expect(result.sinceDays).toBe(7);
    expect(result.events).toEqual([
      { name: 'restaurant_detail_open', count: 40 },
      { name: 'reservation_started', count: 12 },
      { name: 'reservation_completed', count: 9 },
    ]);
  });

  it('varsayılan pencere 7 gündür', async () => {
    mockPrisma.analyticsEvent.groupBy.mockResolvedValue([]);
    await getFunnelSummary();
    const where = mockPrisma.analyticsEvent.groupBy.mock.calls[0][0].where;
    const expectedSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(where.createdAt.gte.getTime() - expectedSince)).toBeLessThan(5000);
  });
});
