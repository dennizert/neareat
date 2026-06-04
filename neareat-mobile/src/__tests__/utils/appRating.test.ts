import { computeAppRating } from '../../utils/appRating';

// #256 — uygulama puanı ortalaması + oy sayısı

describe('computeAppRating', () => {
  it('ortalamayı ve sayıyı doğru hesaplar', () => {
    expect(computeAppRating([{ rating: 4 }, { rating: 5 }, { rating: 5 }]))
      .toEqual({ avg: 14 / 3, count: 3 });
  });

  it('tek ondalığa yuvarlandığında 4.7 verir', () => {
    const { avg } = computeAppRating([{ rating: 4 }, { rating: 5 }, { rating: 5 }]);
    expect(avg.toFixed(1)).toBe('4.7');
  });

  it('boş dizi → avg 0, count 0', () => {
    expect(computeAppRating([])).toEqual({ avg: 0, count: 0 });
  });
});
