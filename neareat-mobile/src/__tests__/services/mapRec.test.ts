import { mapRec } from '../../services/social';
import type { RawRecommendation } from '../../types';

describe('mapRec (S14-M2 tipli eşleme)', () => {
  it('ham recommendation kaydını UI Recommendation tipine çevirir', () => {
    const raw: RawRecommendation = {
      id: 'r1', fromUserId: 'u1', toUserId: 'me', createdAt: '2026-06-13T00:00:00Z',
      placeId: 'p1', placeName: 'Test Lokanta', placeRating: 4.5, placeTypes: ['restaurant'],
      placePhotoUrl: 'http://x/p.jpg', message: 'Harika',
    };
    const rec = mapRec(raw);
    expect(rec.id).toBe('r1');
    expect(rec.restaurant.placeId).toBe('p1');
    expect(rec.restaurant.name).toBe('Test Lokanta');
    expect(rec.restaurant.rating).toBe(4.5);
    expect(rec.message).toBe('Harika');
  });

  it('eksik opsiyonel alanlarda güvenli varsayılanlar üretir', () => {
    const raw: RawRecommendation = {
      id: 'r2', fromUserId: 'u1', toUserId: null, createdAt: '2026-06-13T00:00:00Z',
      placeId: 'p2', placeName: 'Yer',
    };
    const rec = mapRec(raw);
    expect(rec.fromProfile).toBeNull();
    expect(rec.message).toBe('');
    expect(rec.restaurant.rating).toBe(0);
    expect(rec.restaurant.types).toEqual([]);
    expect(rec.restaurant.photoUrl).toBeNull();
  });
});
