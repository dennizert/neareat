import { Alert } from 'react-native';
import {
  isPremiumRequired,
  handleRestaurantPremiumError,
} from '../../utils/premiumGate';

describe('premiumGate', () => {
  describe('isPremiumRequired', () => {
    it('response.data.code === PREMIUM_REQUIRED → true', () => {
      expect(isPremiumRequired({ response: { data: { code: 'PREMIUM_REQUIRED' } } })).toBe(true);
    });
    it('top-level code === PREMIUM_REQUIRED → true', () => {
      expect(isPremiumRequired({ code: 'PREMIUM_REQUIRED' })).toBe(true);
    });
    it('başka hata → false', () => {
      expect(isPremiumRequired({ response: { data: { error: 'Başka hata' } } })).toBe(false);
      expect(isPremiumRequired(new Error('boom'))).toBe(false);
      expect(isPremiumRequired(undefined)).toBe(false);
    });
  });

  describe('handleRestaurantPremiumError', () => {
    beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    it('premium hatasında Alert gösterir + true döner', () => {
      const handled = handleRestaurantPremiumError(
        { response: { data: { code: 'PREMIUM_REQUIRED', error: 'Kampanya Premium gerektirir.' } } },
      );
      expect(handled).toBe(true);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Premium Gerekli',
        'Kampanya Premium gerektirir.',
        expect.any(Array),
      );
    });

    it('premium dışı hatada false döner, Alert göstermez', () => {
      const handled = handleRestaurantPremiumError(new Error('x'));
      expect(handled).toBe(false);
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });
});
