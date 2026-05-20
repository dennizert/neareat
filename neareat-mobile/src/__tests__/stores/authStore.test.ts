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

import { useAuthStore } from '../../store/authStore';
import type { User, Subscription } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  user: null,
  pendingUser: null,
  subscription: null,
  token: null,
  restaurantStatus: null,
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
