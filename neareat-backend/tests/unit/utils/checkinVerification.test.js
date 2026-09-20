'use strict';

/**
 * S18-3 devamı — check-in konum doğrulaması.
 *
 * Açık: `POST /api/checkin` gövdedeki placeId'yi hiç doğrulamadan yazıyordu ve o satır
 * `starGuards.hasVerifiedVisit`in kanıtıydı → tek istekle "doğrulanmış ziyaret" üretip
 * REVIEW/RATING yıldızı kazanmak, oradan da LEVEL_ACCESS özelliklerini açmak mümkündü.
 */

const {
  parseCoord,
  isWithinRadius,
  extractPlaceCoord,
  verifyCheckinLocation,
} = require('../../../src/utils/checkinVerification');

// Taksim Meydanı ve yakın/uzak referanslar
const TAKSIM = { lat: 41.0370, lng: 28.9850 };
const details = (lat, lng) => ({ geometry: { location: { lat, lng } } });

describe('parseCoord', () => {
  it('geçerli koordinatı sayıya çevirir (string dahil)', () => {
    expect(parseCoord('41.037', '28.985')).toEqual({ lat: 41.037, lng: 28.985 });
  });

  it.each([
    ['undefined', undefined, undefined],
    ['null', null, null],
    ['sayı değil', 'abc', 'def'],
    ['NaN', NaN, NaN],
    ['Infinity', Infinity, 0],
    ['enlem aralık dışı', 91, 28],
    ['boylam aralık dışı', 41, 181],
  ])('%s → null', (_label, lat, lng) => {
    expect(parseCoord(lat, lng)).toBeNull();
  });

  // (0,0) pratikte "koordinat yok" sentinel'i; geçerli sayılırsa Gine Körfezi'ndeki
  // hiçbir mekâna yakın olmadığı için zaten reddedilirdi, ama niyeti netleştiriyoruz.
  it('(0,0) sentinel değeri null sayılır', () => {
    expect(parseCoord(0, 0)).toBeNull();
  });
});

describe('isWithinRadius', () => {
  it('yarıçap içinde true', () => expect(isWithinRadius(100, 250)).toBe(true));
  it('sınırda true (kapsayıcı)', () => expect(isWithinRadius(250, 250)).toBe(true));
  it('dışında false', () => expect(isWithinRadius(251, 250)).toBe(false));
  it('maxMeters 0 → doğrulama kapalı, her zaman true', () => {
    expect(isWithinRadius(999999, 0)).toBe(true);
  });
});

describe('extractPlaceCoord', () => {
  it('geometry.location çıkarır', () => {
    expect(extractPlaceCoord(details(41.037, 28.985))).toEqual({ lat: 41.037, lng: 28.985 });
  });
  it.each([
    ['undefined', undefined],
    ['geometry yok', {}],
    ['location yok', { geometry: {} }],
  ])('%s → null', (_l, input) => expect(extractPlaceCoord(input)).toBeNull());
});

describe('verifyCheckinLocation', () => {
  const getPlaceDetails = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    getPlaceDetails.mockResolvedValue(details(TAKSIM.lat, TAKSIM.lng));
  });

  it('mekâna yakınsa doğrular ve mesafeyi kaydeder', async () => {
    const r = await verifyCheckinLocation({
      lat: TAKSIM.lat, lng: TAKSIM.lng, placeId: 'p1', getPlaceDetails, maxMeters: 250,
    });
    expect(r.verified).toBe(true);
    expect(r.reason).toBe('ok');
    expect(r.distanceMeters).toBe(0);
    expect(r.lat).toBe(TAKSIM.lat);
  });

  // ASIL AÇIK: koordinat göndermeyen istemci artık ziyaret kanıtı üretemez.
  it('koordinat yoksa doğrulanmaz (eski istemci) ama hata FIRLATMAZ', async () => {
    const r = await verifyCheckinLocation({ placeId: 'p1', getPlaceDetails });
    expect(r.verified).toBe(false);
    expect(r.reason).toBe('no_coords');
    expect(r.lat).toBeNull();
    // Mekân sorgusu bile yapılmamalı — gereksiz Google çağrısı
    expect(getPlaceDetails).not.toHaveBeenCalled();
  });

  it('uzaktaki kullanıcı doğrulanmaz ama mesafe denetim için kaydedilir', async () => {
    // Kadıköy ≈ 5 km ötede
    const r = await verifyCheckinLocation({
      lat: 40.9900, lng: 29.0300, placeId: 'p1', getPlaceDetails, maxMeters: 250,
    });
    expect(r.verified).toBe(false);
    expect(r.reason).toBe('too_far');
    expect(r.distanceMeters).toBeGreaterThan(4000);
    expect(r.lat).toBe(40.99); // reddedilen deneme de kaydedilir
  });

  it('sahte konum bayrağı doğrulamayı engeller ve Google çağrısı yapılmaz', async () => {
    const r = await verifyCheckinLocation({
      lat: TAKSIM.lat, lng: TAKSIM.lng, mocked: true, placeId: 'p1', getPlaceDetails,
    });
    expect(r.verified).toBe(false);
    expect(r.reason).toBe('mocked_location');
    expect(r.mocked).toBe(true);
    expect(getPlaceDetails).not.toHaveBeenCalled();
  });

  // FAIL-CLOSED: Google çökerse check-in yine oluşur (çağıran fırlatmaz) ama
  // doğrulayamadığımız ziyaret yıldız kazandırmaz.
  it('Google Places hatası fırlatmaz, doğrulanmamış döner', async () => {
    getPlaceDetails.mockRejectedValue(new Error('ZERO_RESULTS'));
    const r = await verifyCheckinLocation({
      lat: TAKSIM.lat, lng: TAKSIM.lng, placeId: 'p1', getPlaceDetails,
    });
    expect(r.verified).toBe(false);
    expect(r.reason).toBe('place_lookup_failed');
  });

  it('mekânın geometry bilgisi yoksa doğrulanmaz', async () => {
    getPlaceDetails.mockResolvedValue({});
    const r = await verifyCheckinLocation({
      lat: TAKSIM.lat, lng: TAKSIM.lng, placeId: 'p1', getPlaceDetails,
    });
    expect(r.verified).toBe(false);
    expect(r.reason).toBe('place_has_no_geometry');
  });

  it('yarıçap içindeki makul sapmayı kabul eder (~150 m)', async () => {
    // ~0.00135° enlem ≈ 150 m
    const r = await verifyCheckinLocation({
      lat: TAKSIM.lat + 0.00135, lng: TAKSIM.lng, placeId: 'p1', getPlaceDetails, maxMeters: 250,
    });
    expect(r.verified).toBe(true);
    expect(r.distanceMeters).toBeGreaterThan(100);
    expect(r.distanceMeters).toBeLessThan(200);
  });
});
