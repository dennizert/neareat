import * as SecureStore from 'expo-secure-store';
import { MOCK_MODE } from '../config';
import { MOCK_USER } from '../mocks/data';
import type { User, Subscription, RestaurantProfile } from '../types';
import api, { setTokenGetter } from './api';

// Only import native module when not in mock mode
let GoogleSignin: any = null;
if (!MOCK_MODE) {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
}

// SecureStore: Android Keystore / iOS Keychain — AsyncStorage'dan farklı olarak şifreli
const TOKEN_KEY = 'neareat_auth_token';

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  setTokenGetter(getStoredToken);
}

export async function clearStoredToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  setTokenGetter(null as any);
}

export function configureGoogleSignIn(webClientId: string) {
  if (MOCK_MODE || !GoogleSignin) return;
  GoogleSignin.configure({ webClientId });
}

export async function signInWithGoogle(): Promise<{ user: User; subscription: Subscription | null }> {
  if (MOCK_MODE) return { user: MOCK_USER, subscription: null };

  await GoogleSignin.hasPlayServices();
  await GoogleSignin.signIn();
  const { idToken } = await GoogleSignin.getTokens();

  setTokenGetter(async () => {
    const tokens = await GoogleSignin.getTokens();
    return tokens.idToken;
  });

  const { data } = await api.post('/auth/login', { idToken });
  return data;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<{ user: User; subscription: Subscription | null }> {
  if (MOCK_MODE) {
    return { user: { ...MOCK_USER, email, displayName, authProvider: 'email' }, subscription: null };
  }
  const { data } = await api.post('/auth/register', { email, password, displayName });
  await storeToken(data.token);
  return data;
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<{ user: User; subscription: Subscription | null }> {
  if (MOCK_MODE) {
    return { user: MOCK_USER, subscription: null };
  }
  const { data } = await api.post('/auth/login/email', { email, password });
  await storeToken(data.token);
  return data;
}

export async function signOut() {
  await clearStoredToken();
  if (!MOCK_MODE && GoogleSignin) {
    try {
      await GoogleSignin.signOut();
    } catch {
      // Google Sign-In configured değilse ignore
    }
  }
}

export async function getMe(): Promise<{ user: User; subscription: Subscription | null; restaurantProfile?: Pick<RestaurantProfile, 'id' | 'status' | 'rejectionReason' | 'businessName' | 'placeId'> | null }> {
  if (MOCK_MODE) return { user: MOCK_USER, subscription: null };
  const { data } = await api.get('/auth/me');
  return data;
}

export async function restoreSession(): Promise<boolean> {
  const token = await getStoredToken();
  if (!token) return false;
  setTokenGetter(getStoredToken);
  return true;
}
