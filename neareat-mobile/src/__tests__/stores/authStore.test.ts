/**
 * authStore Tests
 *
 * Tests for the Zustand-based auth store.
 * expo-secure-store is mocked so tests run without native modules.
 * Store state is reset before each test to prevent cross-test pollution.
 */

// Mock expo-secure-store (native module, not available in Jest)
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// loadSubscription HTTP çağrısı yapar — #451 EK-1 testleri için mock'lanır.
const mockApiGet = jest.fn();
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: (...a: any[]) => mockApiGet(...a) },
}));

import { useAuthStore } from '../../store/authStore';
import type { User, Subscription } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  user: null,
  pendingUser: null,
  subscription: null,
  token: null,
  restaurantStatus: null,
  sessionId: 1,
};

function resetStore() {
  useAuthStore.setState(INITIAL_STATE);
}

const mockUser: User = {
  id: 'user-1',
  googleId: null,
  email: 'test@example.com',
  displayName: 'Test User',
  photoUrl: null,
  fcmToken: null,
  authProvider: 'email',
  emailVerified: false,
  role: 'USER',
  isSuspended: false,
  starCount: 0,
};

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    userId: 'user-1',
    planType: 'monthly',
    status: 'active',
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 days
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
  jest.clearAllMocks();
});

describe('authStore — initial state', () => {
  it('user is null', () => {
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('pendingUser is null', () => {
    expect(useAuthStore.getState().pendingUser).toBeNull();
  });

  it('subscription is null', () => {
    expect(useAuthStore.getState().subscription).toBeNull();
  });

  it('token is null', () => {
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('restaurantStatus is null', () => {
    expect(useAuthStore.getState().restaurantStatus).toBeNull();
  });
});

describe('authStore — setUser()', () => {
  it('sets user in state', () => {
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('clears pendingUser when setUser is called', () => {
    // First put someone in pendingUser
    useAuthStore.setState({ pendingUser: mockUser });
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().pendingUser).toBeNull();
  });

  it('accepts null to clear the user', () => {
    useAuthStore.setState({ user: mockUser });
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('authStore — setPendingUser()', () => {
  it('sets pendingUser in state', () => {
    useAuthStore.getState().setPendingUser(mockUser);
    expect(useAuthStore.getState().pendingUser).toEqual(mockUser);
  });

  it('accepts null to clear pendingUser', () => {
    useAuthStore.setState({ pendingUser: mockUser });
    useAuthStore.getState().setPendingUser(null);
    expect(useAuthStore.getState().pendingUser).toBeNull();
  });
});

describe('authStore — setSubscription()', () => {
  it('sets subscription in state', () => {
    const sub = makeSub();
    useAuthStore.getState().setSubscription(sub);
    expect(useAuthStore.getState().subscription).toEqual(sub);
  });

  it('accepts null to clear subscription', () => {
    useAuthStore.setState({ subscription: makeSub() });
    useAuthStore.getState().setSubscription(null);
    expect(useAuthStore.getState().subscription).toBeNull();
  });
});

describe('authStore — setToken()', () => {
  it('sets token in state', () => {
    useAuthStore.getState().setToken('jwt-abc-123');
    expect(useAuthStore.getState().token).toBe('jwt-abc-123');
  });

  it('accepts null to clear token', () => {
    useAuthStore.setState({ token: 'old-token' });
    useAuthStore.getState().setToken(null);
    expect(useAuthStore.getState().token).toBeNull();
  });
});

describe('authStore — setRestaurantStatus()', () => {
  it('sets restaurantStatus in state', () => {
    const status = { status: 'APPROVED' };
    useAuthStore.getState().setRestaurantStatus(status);
    expect(useAuthStore.getState().restaurantStatus).toEqual(status);
  });

  it('sets restaurantStatus with rejectionReason', () => {
    const status = { status: 'REJECTED', rejectionReason: 'Incomplete documents' };
    useAuthStore.getState().setRestaurantStatus(status);
    expect(useAuthStore.getState().restaurantStatus).toEqual(status);
  });

  it('accepts null to clear restaurantStatus', () => {
    useAuthStore.setState({ restaurantStatus: { status: 'PENDING' } });
    useAuthStore.getState().setRestaurantStatus(null);
    expect(useAuthStore.getState().restaurantStatus).toBeNull();
  });
});

describe('authStore — isPremium()', () => {
  it('returns false when subscription is null', () => {
    expect(useAuthStore.getState().isPremium()).toBe(false);
  });

  it('returns true when subscription status is "active" with future expiresAt', () => {
    useAuthStore.setState({ subscription: makeSub({ status: 'active' }) });
    expect(useAuthStore.getState().isPremium()).toBe(true);
  });

  it('returns true when subscription status is "trial" with future expiresAt', () => {
    useAuthStore.setState({ subscription: makeSub({ status: 'trial', planType: 'trial' }) });
    expect(useAuthStore.getState().isPremium()).toBe(true);
  });

  it('returns false when subscription status is "expired"', () => {
    useAuthStore.setState({
      subscription: makeSub({
        status: 'expired',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    });
    expect(useAuthStore.getState().isPremium()).toBe(false);
  });

  it('returns false when subscription status is "cancelled"', () => {
    useAuthStore.setState({
      subscription: makeSub({
        status: 'cancelled',
        expiresAt: new Date(Date.now() + 10000).toISOString(),
      }),
    });
    expect(useAuthStore.getState().isPremium()).toBe(false);
  });

  it('returns false when subscription is active but expiresAt is in the past', () => {
    useAuthStore.setState({
      subscription: makeSub({
        status: 'active',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // expired yesterday
      }),
    });
    expect(useAuthStore.getState().isPremium()).toBe(false);
  });
});

describe('authStore — logout()', () => {
  it('clears user after logout', async () => {
    useAuthStore.setState({ user: mockUser });
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('clears pendingUser after logout', async () => {
    useAuthStore.setState({ pendingUser: mockUser });
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().pendingUser).toBeNull();
  });

  it('clears subscription after logout', async () => {
    useAuthStore.setState({ subscription: makeSub() });
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().subscription).toBeNull();
  });

  it('clears token after logout', async () => {
    useAuthStore.setState({ token: 'some-token' });
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('clears restaurantStatus after logout', async () => {
    useAuthStore.setState({ restaurantStatus: { status: 'APPROVED' } });
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().restaurantStatus).toBeNull();
  });

  it('calls SecureStore.deleteItemAsync with the auth token key', async () => {
    const SecureStore = require('expo-secure-store');
    await useAuthStore.getState().logout();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('neareat_auth_token');
  });
});

describe('authStore — clear()', () => {
  it('resets all state fields to null without touching SecureStore', () => {
    const SecureStore = require('expo-secure-store');
    useAuthStore.setState({
      user: mockUser,
      pendingUser: mockUser,
      subscription: makeSub(),
      token: 'tok',
      restaurantStatus: { status: 'APPROVED' },
    });

    useAuthStore.getState().clear();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().pendingUser).toBeNull();
    expect(useAuthStore.getState().subscription).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().restaurantStatus).toBeNull();
    // clear() must NOT call SecureStore (only logout does)
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});

describe('authStore — state independence between tests', () => {
  it('does not see state set in other tests (pollution check A)', () => {
    useAuthStore.setState({ token: 'token-A' });
    expect(useAuthStore.getState().token).toBe('token-A');
  });

  it('does not see state set in other tests (pollution check B)', () => {
    // beforeEach reset means token-A from previous test must not be here
    expect(useAuthStore.getState().token).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// #451 — oturum nesli (A02) ve loadSubscription kapısı (EK-1)
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — oturum nesli (A02)', () => {
  beforeEach(resetStore);

  it('T13 çıkış nesli ilerletir — eski oturumun 401\'i artık güncel sayılmaz', async () => {
    const before = useAuthStore.getState().sessionId;
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().sessionId).toBe(before + 1);
  });

  it('T13b farklı kullanıcıya geçiş nesli ilerletir', () => {
    useAuthStore.getState().setUser(mockUser);
    const afterFirst = useAuthStore.getState().sessionId;
    useAuthStore.getState().setUser({ ...mockUser, id: 'user-2' });
    expect(useAuthStore.getState().sessionId).toBe(afterFirst + 1);
  });

  // getMe tazelemesi aynı kullanıcıyı tekrar yazar; nesil ilerlerse kendi uçuştaki
  // isteklerimiz "eski" sayılır ve gerçek bir 401 sessizce yutulurdu.
  it('AYNI kullanıcıyı tekrar yazmak nesli ilerletmez', () => {
    useAuthStore.getState().setUser(mockUser);
    const after = useAuthStore.getState().sessionId;
    useAuthStore.getState().setUser({ ...mockUser, displayName: 'Yeni Ad' });
    expect(useAuthStore.getState().sessionId).toBe(after);
  });

  it('clear() de nesli ilerletir', () => {
    const before = useAuthStore.getState().sessionId;
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().sessionId).toBe(before + 1);
  });
});

describe('authStore — loadSubscription kapısı (EK-1)', () => {
  beforeEach(() => {
    resetStore();
    mockApiGet.mockReset();
  });

  // ASIL HATA: kapı `if (!get().token) return` idi. `setToken` yalnızca
  // RestaurantRegisterScreen'de çağrılıyor; normal girişler çağırmıyor ve store
  // persist edilmiyor → token her zaman null → bu fonksiyon HİÇ çalışmıyordu.
  it('T14 giriş yapmış kullanıcıda çalışır (store.token null olsa bile)', async () => {
    useAuthStore.setState({ user: mockUser, token: null });
    mockApiGet.mockResolvedValue({ data: { status: 'active', expiresAt: '2099-01-01' } });

    await useAuthStore.getState().loadSubscription();

    expect(mockApiGet).toHaveBeenCalledWith('/subscriptions');
    expect(useAuthStore.getState().subscription).toEqual({ status: 'active', expiresAt: '2099-01-01' });
  });

  it('giriş yapılmamışsa istek atmaz', async () => {
    useAuthStore.setState({ user: null });
    await useAuthStore.getState().loadSubscription();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('hata sessizce yutulur, mevcut abonelik korunur', async () => {
    const existing = { status: 'trial', expiresAt: '2099-01-01' } as any;
    useAuthStore.setState({ user: mockUser, subscription: existing });
    mockApiGet.mockRejectedValue(new Error('network'));

    await useAuthStore.getState().loadSubscription();

    expect(useAuthStore.getState().subscription).toBe(existing);
  });
});
