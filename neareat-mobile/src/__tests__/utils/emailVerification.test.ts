import { shouldShowVerifyBanner } from '../../utils/emailVerification';
import type { User } from '../../types';

function mkUser(over: Partial<User> = {}): User {
  return {
    id: 'u1', googleId: null, email: 'a@b.com', displayName: 'A', photoUrl: null,
    fcmToken: null, authProvider: 'email', role: 'USER', isSuspended: false,
    emailVerified: false, ...over,
  } as User;
}

describe('shouldShowVerifyBanner (S14-M1)', () => {
  it('e-posta ile kayıtlı + doğrulanmamış → true', () => {
    expect(shouldShowVerifyBanner(mkUser({ authProvider: 'email', emailVerified: false }))).toBe(true);
  });
  it('e-posta + doğrulanmış → false', () => {
    expect(shouldShowVerifyBanner(mkUser({ authProvider: 'email', emailVerified: true }))).toBe(false);
  });
  it('Google kullanıcısı → false', () => {
    expect(shouldShowVerifyBanner(mkUser({ authProvider: 'google', emailVerified: false }))).toBe(false);
  });
  it('kullanıcı yoksa → false', () => {
    expect(shouldShowVerifyBanner(null)).toBe(false);
  });
});
