import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingScreen from '../../screens/OnboardingScreen';
import { requestLocationPermission } from '../../services/location';

// S11-10 — Onboarding + son adımda izin priming

jest.mock('../../services/location', () => ({
  requestLocationPermission: jest.fn().mockResolvedValue(true),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderOnboarding(onDone = jest.fn()) {
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <OnboardingScreen onDone={onDone} />
    </SafeAreaProvider>,
  );
  return onDone;
}

describe('OnboardingScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ilk slaytı ve "İleri" / "Atla" gösterir', () => {
    renderOnboarding();
    expect(screen.getByText('Ne yesem? Sana sorulsun.')).toBeTruthy();
    expect(screen.getByText('İleri')).toBeTruthy();
    expect(screen.getByText('Atla')).toBeTruthy();
  });

  it('Atla → onDone çağrılır', () => {
    const onDone = renderOnboarding();
    fireEvent.press(screen.getByText('Atla'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('son slaytta izin ister ve onDone çağırır', async () => {
    const onDone = renderOnboarding();
    // 3 kez İleri → son slayt
    fireEvent.press(screen.getByText('İleri'));
    fireEvent.press(screen.getByText('İleri'));
    fireEvent.press(screen.getByText('İleri'));
    const startBtn = screen.getByText('İzin Ver ve Başla');
    expect(startBtn).toBeTruthy();
    fireEvent.press(startBtn);
    await waitFor(() => expect(requestLocationPermission).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });
});
