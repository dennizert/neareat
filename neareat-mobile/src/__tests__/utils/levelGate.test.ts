import { Alert } from 'react-native';
import {
  levelForStars,
  nextLevelThreshold,
  starsToNextLevel,
  levelBadge,
  isLevelRequired,
  levelGateMessage,
  handleLevelError,
} from '../../utils/levelGate';

describe('levelGate', () => {
  describe('levelForStars (backend eşikleriyle birebir)', () => {
    it('sınır değerleri', () => {
      expect(levelForStars(0)).toBe(1);
      expect(levelForStars(49)).toBe(1);
      expect(levelForStars(50)).toBe(2);
      expect(levelForStars(99)).toBe(2);
      expect(levelForStars(100)).toBe(3);
      expect(levelForStars(149)).toBe(3);
      expect(levelForStars(150)).toBe(4);
      expect(levelForStars(249)).toBe(4);
      expect(levelForStars(250)).toBe(5);
      expect(levelForStars(1000)).toBe(5);
    });
  });

  describe('nextLevelThreshold / starsToNextLevel', () => {
    it('L1 30 yıldız → sonraki eşik 50, kalan 20', () => {
      expect(nextLevelThreshold(30)).toBe(50);
      expect(starsToNextLevel(30)).toBe(20);
    });
    it('L2 60 → sonraki 100, kalan 40', () => {
      expect(nextLevelThreshold(60)).toBe(100);
      expect(starsToNextLevel(60)).toBe(40);
    });
    it('L5 (300) → null (sınırsız)', () => {
      expect(nextLevelThreshold(300)).toBeNull();
      expect(starsToNextLevel(300)).toBeNull();
    });
  });

  describe('levelBadge', () => {
    it('seviye → rozet adı, clamp', () => {
      expect(levelBadge(1)).toBe('Yeni Kaşif');
      expect(levelBadge(2)).toBe('Gastronomi Meraklısı');
      expect(levelBadge(5)).toBe('Gastronomi Efsanesi');
      expect(levelBadge(0)).toBe('Yeni Kaşif');
      expect(levelBadge(9)).toBe('Gastronomi Efsanesi');
    });
  });

  describe('isLevelRequired', () => {
    it('response.data.code === LEVEL_REQUIRED → true', () => {
      expect(isLevelRequired({ response: { data: { code: 'LEVEL_REQUIRED' } } })).toBe(true);
    });
    it('top-level code → true', () => {
      expect(isLevelRequired({ code: 'LEVEL_REQUIRED' })).toBe(true);
    });
    it('PREMIUM_REQUIRED / diğer → false', () => {
      expect(isLevelRequired({ response: { data: { code: 'PREMIUM_REQUIRED' } } })).toBe(false);
      expect(isLevelRequired(new Error('x'))).toBe(false);
      expect(isLevelRequired(undefined)).toBe(false);
    });
  });

  describe('levelGateMessage', () => {
    it('backend mesajını tercih eder', () => {
      expect(levelGateMessage({ response: { data: { error: 'Seviye 2\'ye ulaş.' } } })).toBe('Seviye 2\'ye ulaş.');
    });
    it('mesaj yoksa requiredLevel ile üretir', () => {
      expect(levelGateMessage({ response: { data: { requiredLevel: 3 } } })).toMatch(/Seviye 3/);
    });
  });

  describe('handleLevelError', () => {
    beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    it('LEVEL_REQUIRED → Alert (Paywall YOK) + true', () => {
      const handled = handleLevelError({ response: { data: { code: 'LEVEL_REQUIRED', error: 'Seviye 2 gerekir.' } } });
      expect(handled).toBe(true);
      expect(Alert.alert).toHaveBeenCalledWith('Seviye Gerekli', 'Seviye 2 gerekir.');
    });

    it('onInfo verilirse Alert yerine onInfo çağrılır', () => {
      const onInfo = jest.fn();
      const handled = handleLevelError({ code: 'LEVEL_REQUIRED', response: { data: { requiredLevel: 2 } } }, { onInfo });
      expect(handled).toBe(true);
      expect(onInfo).toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('LEVEL_REQUIRED dışı → false, Alert yok', () => {
      expect(handleLevelError(new Error('x'))).toBe(false);
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });
});
