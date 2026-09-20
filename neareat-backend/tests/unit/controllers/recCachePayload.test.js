'use strict';

/**
 * S16-3 öneri cache'i — şekil sözleşmesi.
 *
 * JSON (`/dinner-tonight`) ve SSE (`/dinner-tonight/stream`) uçları AYNI cache
 * anahtarını paylaşıyor ama eskiden farklı şekiller yazıyordu: JSON `{recommendations}`,
 * SSE `{cards}`. İki yönlü hata üretiyordu —
 *  - SSE önce yazarsa JSON ucu cache'i yanıta yayıyor, istemciye `recommendations`
 *    alanı OLMAYAN 200 gidiyordu (mobil hata almadan boş liste gösteriyor),
 *  - JSON önce yazarsa SSE ıskalayıp Claude'a gereksiz çağrı yapıyordu.
 *
 * Bu testler şekli tek noktada sabitliyor. Mevcut entegrasyon testi yalnızca
 * JSON→JSON yolunu kapsadığı için çakışmayı hiç görmemişti.
 */

jest.mock('../../../src/utils/prisma', () => ({}));
jest.mock('../../../src/services/redis', () => ({
  cacheGet: jest.fn(), cacheSet: jest.fn(),
  getRedis: () => ({ incr: jest.fn(), expire: jest.fn() }),
}));
jest.mock('../../../src/services/googlePlaces', () => ({}));
jest.mock('../../../src/services/recommendationService', () => ({}));

const { __test } = require('../../../src/controllers/recommendationController');
const { recCacheKey, buildRecCachePayload, readRecCachePayload } = __test;

const CARD = {
  placeId: 'p1',
  reason: 'yakın ve sessiz',
  neverVisited: false,
  restaurant: { name: 'Köşk Kebap', rating: 4.5 },
};

describe('recCacheKey', () => {
  it('kullanıcı + ~1km tile (2 ondalık) ile anahtar üretir', () => {
    expect(recCacheKey('u1', 41.0370, 28.9832)).toBe('rec-cache2:u1:41.04:28.98');
  });

  it('aynı tile içindeki farklı koordinatlar AYNI anahtara düşer', () => {
    expect(recCacheKey('u1', 41.0371, 28.9832)).toBe(recCacheKey('u1', 41.0369, 28.9828));
  });

  // Tile sınırındaki koordinatlar farklı anahtara düşer — `toFixed(2)` tabanlı
  // tile'lamanın doğasında var, bu değişiklikle gelen bir şey değil. Etkisi yalnızca
  // kaçırılmış bir cache isabeti (fazladan bir Claude çağrısı), yanlış veri değil.
  it('tile sınırında bölünme olur (bilinen ve kabul edilen davranış)', () => {
    expect(recCacheKey('u1', 41.04, 28.9849)).not.toBe(recCacheKey('u1', 41.04, 28.9851));
  });

  it('farklı kullanıcılar cache paylaşmaz', () => {
    expect(recCacheKey('u1', 41.04, 28.98)).not.toBe(recCacheKey('u2', 41.04, 28.98));
  });

  // Eski sürümle (`rec-cache:`) yazılmış kayıtların yanlış şekille okunmaması için
  // anahtar sürümlendi — depo konvansiyonu (`nearby3:`→`nearby4:`).
  it('sürümlü önek kullanır, eski kayıtlarla çakışmaz', () => {
    const key = recCacheKey('u1', 41.04, 28.98);
    expect(key.startsWith('rec-cache2:')).toBe(true);
    expect(key.startsWith('rec-cache:')).toBe(false);
  });
});

describe('buildRecCachePayload', () => {
  it('her iki uç için TEK şekil üretir', () => {
    expect(buildRecCachePayload({
      recommendations: [CARD], noteToUser: 'not', tier: 'premium', model: 'claude-sonnet-4-6',
    })).toEqual({
      recommendations: [CARD], noteToUser: 'not', tier: 'premium', model: 'claude-sonnet-4-6',
    });
  });

  // ASIL REGRESYON: SSE ucu `cards` yazıyordu.
  it('`cards` anahtarı ÜRETMEZ', () => {
    const p = buildRecCachePayload({ recommendations: [CARD], noteToUser: null, tier: 'free', model: 'm' });
    expect(p).not.toHaveProperty('cards');
    expect(p.recommendations).toEqual([CARD]);
  });

  // Taze (cache'siz) JSON yanıtı bu nesneyi yayarak oluşturuluyor; fazladan alan
  // eklenirse sözleşmeye sızar.
  it('yalnızca dört alan taşır — volatile alanlar (remaining/resetAt) cache dışı', () => {
    const p = buildRecCachePayload({ recommendations: [CARD], noteToUser: '', tier: 'free', model: 'm' });
    expect(Object.keys(p).sort()).toEqual(['model', 'noteToUser', 'recommendations', 'tier']);
  });

  it('noteToUser değerini olduğu gibi taşır (boş string dahil)', () => {
    expect(buildRecCachePayload({ recommendations: [CARD], noteToUser: '', tier: 'free', model: 'm' }).noteToUser).toBe('');
  });
});

describe('readRecCachePayload', () => {
  it('geçerli kaydı okur', () => {
    const r = readRecCachePayload({ recommendations: [CARD], noteToUser: 'n', tier: 'free', model: 'm' });
    expect(r.recommendations).toEqual([CARD]);
    expect(r.tier).toBe('free');
  });

  // Yanlış şekli yarı yarıya kullanmaktansa MISS saymak doğru: çağıran taze üretir.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['boş nesne', {}],
    ['eski SSE şekli ({cards})', { cards: [CARD], tier: 'free' }],
    ['boş dizi', { recommendations: [] }],
    ['dizi değil', { recommendations: { 0: CARD } }],
  ])('%s → null (cache MISS gibi davranılır)', (_label, input) => {
    expect(readRecCachePayload(input)).toBeNull();
  });

  it('build → read gidiş-dönüşü kaybı olmadan çalışır', () => {
    const written = buildRecCachePayload({
      recommendations: [CARD], noteToUser: 'not', tier: 'premium', model: 'm',
    });
    // Redis JSON serileştirmesini taklit et
    expect(readRecCachePayload(JSON.parse(JSON.stringify(written)))).toEqual(written);
  });
});
