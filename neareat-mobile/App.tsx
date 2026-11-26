import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// Edge-to-edge'de RN'in kendi klavye primitifi güvenilir değil (bulgu E6):
// IME inset'ini native taraftan dinleyen sağlayıcı en dışta kurulur.
import { KeyboardProvider } from 'react-native-keyboard-controller';
import Navigation from './src/navigation';
import ErrorBoundary from './src/components/ErrorBoundary';
import { ToastProvider } from './src/components/Toast';
import OnboardingGate from './src/components/OnboardingGate';
import { configureGoogleSignIn } from './src/services/auth';
import { MOCK_MODE, GOOGLE_WEB_CLIENT_ID } from './src/config';
import { useAuthStore } from './src/store/authStore';
import { initSentry, wrapWithSentry } from './src/services/sentry';
import { setAnalyticsSink } from './src/services/analytics';
import { backendAnalyticsSink } from './src/services/analyticsBackendSink';

// Crash reporting'i (S14-M3) mümkün olduğunca erken başlat — DSN yoksa no-op.
initSentry();

if (!MOCK_MODE) {
  configureGoogleSignIn(GOOGLE_WEB_CLIENT_ID);
  // #481 — 5 funnel event'i (paywall/detay/rezervasyon/AI öneri) kodda üretiliyordu
  // ama setAnalyticsSink hiç çağrılmadığı için boşluğa akıyordu. MOCK_MODE'da
  // takılmıyor: gerçek backend yok, event'ler gitmemeli.
  setAnalyticsSink(backendAnalyticsSink);
}

function App() {
  const loadSubscription = useAuthStore((s) => s.loadSubscription);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        loadSubscription();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [loadSubscription]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ToastProvider>
          <OnboardingGate>
            <ErrorBoundary>
              <Navigation />
            </ErrorBoundary>
          </OnboardingGate>
        </ToastProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

// DSN tanımlıysa Sentry error boundary'siyle sarılır; değilse App olduğu gibi export edilir.
export default wrapWithSentry(App);
