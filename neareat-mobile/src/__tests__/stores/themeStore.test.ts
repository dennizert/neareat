/**
 * themeStore Tests
 *
 * Tests for the Zustand-based theme store (with AsyncStorage persistence).
 * AsyncStorage is mocked so tests run without native modules.
 * Store state is reset before each test to prevent cross-test pollution.
 */

// Mock AsyncStorage (native module, not available in Jest)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { useThemeStore } from '../../store/themeStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetStore() {
  // Reset to default state; persist middleware is present but AsyncStorage
  // is mocked, so hydration does not interfere during tests.
  useThemeStore.setState({ isDark: false });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
});

describe('themeStore — initial state', () => {
  it('isDark is false', () => {
    expect(useThemeStore.getState().isDark).toBe(false);
  });

  it('isDark is a boolean (not undefined or null)', () => {
    const { isDark } = useThemeStore.getState();
    expect(typeof isDark).toBe('boolean');
  });
});

describe('themeStore — toggle()', () => {
  it('switches isDark from false to true', () => {
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().isDark).toBe(true);
  });

  it('switches isDark from true to false (double toggle)', () => {
    useThemeStore.getState().toggle(); // false → true
    useThemeStore.getState().toggle(); // true → false
    expect(useThemeStore.getState().isDark).toBe(false);
  });

  it('returns to initial state after even number of toggles', () => {
    for (let i = 0; i < 6; i++) {
      useThemeStore.getState().toggle();
    }
    expect(useThemeStore.getState().isDark).toBe(false);
  });

  it('is in dark mode after odd number of toggles', () => {
    for (let i = 0; i < 5; i++) {
      useThemeStore.getState().toggle();
    }
    expect(useThemeStore.getState().isDark).toBe(true);
  });
});

describe('themeStore — setDark()', () => {
  it('setDark(true) sets isDark to true', () => {
    useThemeStore.getState().setDark(true);
    expect(useThemeStore.getState().isDark).toBe(true);
  });

  it('setDark(false) sets isDark to false', () => {
    useThemeStore.setState({ isDark: true });
    useThemeStore.getState().setDark(false);
    expect(useThemeStore.getState().isDark).toBe(false);
  });

  it('setDark(true) twice keeps isDark as true', () => {
    useThemeStore.getState().setDark(true);
    useThemeStore.getState().setDark(true);
    expect(useThemeStore.getState().isDark).toBe(true);
  });

  it('setDark(false) twice keeps isDark as false', () => {
    useThemeStore.setState({ isDark: true });
    useThemeStore.getState().setDark(false);
    useThemeStore.getState().setDark(false);
    expect(useThemeStore.getState().isDark).toBe(false);
  });

  it('setDark overrides a previous toggle result', () => {
    useThemeStore.getState().toggle(); // false → true
    useThemeStore.getState().setDark(false); // force back to false
    expect(useThemeStore.getState().isDark).toBe(false);
  });
});

describe('themeStore — state independence between tests', () => {
  it('does not carry over isDark=true set in another test (pollution check A)', () => {
    useThemeStore.getState().setDark(true);
    expect(useThemeStore.getState().isDark).toBe(true);
  });

  it('does not carry over isDark=true set in another test (pollution check B)', () => {
    // beforeEach reset means this must start at false regardless of test A
    expect(useThemeStore.getState().isDark).toBe(false);
  });
});
