import * as Haptics from 'expo-haptics';
import { haptics } from '../../utils/haptics';

// S11-9 — haptik util (expo-haptics jest.setup'ta mock'lu)

describe('haptics util', () => {
  beforeEach(() => jest.clearAllMocks());

  it('light → impactAsync(Light)', () => {
    haptics.light();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('success → notificationAsync(Success)', () => {
    haptics.success();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  it('haptik reddedilse bile çağrı çökmez (best-effort)', () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error('no haptics'));
    expect(() => haptics.medium()).not.toThrow();
  });
});
