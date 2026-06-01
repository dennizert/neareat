import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Navigation from './src/navigation';
import ErrorBoundary from './src/components/ErrorBoundary';
import { configureGoogleSignIn } from './src/services/auth';
import { MOCK_MODE, GOOGLE_WEB_CLIENT_ID } from './src/config';

if (!MOCK_MODE) {
  configureGoogleSignIn(GOOGLE_WEB_CLIENT_ID);
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ErrorBoundary>
          <Navigation />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
