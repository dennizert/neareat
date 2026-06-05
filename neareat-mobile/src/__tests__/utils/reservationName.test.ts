import { reservationRestaurantName } from '../../utils/reservationName';

// Rezervasyon ekranlarında restoran adı: Görünen Ad varsa o, yoksa Google adı.

describe('reservationRestaurantName', () => {
  it('Görünen Ad (displayName) varsa onu döner', () => {
    expect(
      reservationRestaurantName({
        placeName: 'Google Restaurant Adı',
        restaurant: { displayName: 'Lezzet Durağı', businessName: 'XYZ Gıda Ltd.' },
      })
    ).toBe('Lezzet Durağı');
  });

  it('displayName yoksa Google adını (placeName) döner', () => {
    expect(
      reservationRestaurantName({
        placeName: 'Google Restaurant Adı',
        restaurant: { displayName: null, businessName: 'XYZ Gıda Ltd.' },
      })
    ).toBe('Google Restaurant Adı');
  });

  it('displayName boşluktan ibaretse Google adına düşer', () => {
    expect(
      reservationRestaurantName({
        placeName: 'Google Restaurant Adı',
        restaurant: { displayName: '   ', businessName: 'XYZ Gıda Ltd.' },
      })
    ).toBe('Google Restaurant Adı');
  });

  it('placeName de yoksa businessName fallback olur', () => {
    expect(
      reservationRestaurantName({
        placeName: '',
        restaurant: { displayName: null, businessName: 'XYZ Gıda Ltd.' },
      })
    ).toBe('XYZ Gıda Ltd.');
  });

  it('hiçbiri yoksa "Restoran" döner', () => {
    expect(
      reservationRestaurantName({ placeName: '', restaurant: null })
    ).toBe('Restoran');
  });
});
