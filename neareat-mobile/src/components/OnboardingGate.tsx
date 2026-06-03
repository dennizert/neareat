import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingScreen from '../screens/OnboardingScreen';

const SEEN_KEY = 'eatlas_onboarding_seen';

/**
 * S11-10 — İlk açılışta onboarding'i gösterir; tamamlanınca bir daha göstermez.
 * Bayrak AsyncStorage'da kalıcı tutulur. Okuma hatası → onboarding'i atla (engelleme).
 */
export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'onboarding' | 'done'>('loading');

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => setStatus(v ? 'done' : 'onboarding'))
      .catch(() => setStatus('done'));
  }, []);

  if (status === 'loading') return null; // çok kısa; splash görünür kalır
  if (status === 'onboarding') {
    return (
      <OnboardingScreen
        onDone={() => {
          AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
          setStatus('done');
        }}
      />
    );
  }
  return <>{children}</>;
}
