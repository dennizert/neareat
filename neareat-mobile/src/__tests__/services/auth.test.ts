/**
 * #430 — auth.ts servis katmanı: token depolama/restore mantığı, Google idToken
 * single-flight dedup ve backend login/register sözleşmesi (MOCK_MODE=false,
 * üretimde her zaman böyle).
 */
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// v13+ sözleşmesi: signIn/signInSilently artık hata fırlatmak yerine
// ayrıştırılmış (discriminated) bir sonuç objesi döndürür:
//   signIn         → { type:'success', data } | { type:'cancelled', data:null }
//   signInSilently → { type:'success', data } | { type:'noSavedCredentialFound', data:null }
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({ type: 'success', data: {} }),
    getTokens: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
    signInSilently: jest.fn(),
  },
}));

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
  setTokenGetter: jest.fn(),
}));

import {
  getStoredToken,
  clearStoredToken,
  configureGoogleSignIn,
  signInWithGoogle,
  registerWithEmail,
  loginWithEmail,
  signOut,
  getMe,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  restoreSession,
} from '../../services/auth';

const SecureStore = require('expo-secure-store');
const { GoogleSignin } = require('@react-native-google-signin/google-signin');
const apiModule = require('../../services/api');
const mockedApi = apiModule.default;
const mockSetTokenGetter = apiModule.setTokenGetter as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('token depolama', () => {
  it('getStoredToken SecureStore anahtarını okur', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('tok-1');
    const result = await getStoredToken();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('neareat_auth_token');
    expect(result).toBe('tok-1');
  });

  it('clearStoredToken SecureStore siler ve token getter temizler', async () => {
    await clearStoredToken();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('neareat_auth_token');
    expect(mockSetTokenGetter).toHaveBeenCalledWith(null);
  });
});

describe('configureGoogleSignIn', () => {
  it('webClientId ile GoogleSignin.configure çağırır', () => {
    configureGoogleSignIn('client-id-1');
    expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: 'client-id-1' });
  });
});

describe('signInWithGoogle', () => {
  it('Play Services → signIn → idToken → backend login sırasını izler', async () => {
    GoogleSignin.getTokens.mockResolvedValue({ idToken: 'gid-1' });
    mockedApi.post.mockResolvedValueOnce({ data: { user: { id: 'u1' }, subscription: null } });

    const result = await signInWithGoogle();

    expect(GoogleSignin.hasPlayServices).toHaveBeenCalled();
    expect(GoogleSignin.signIn).toHaveBeenCalled();
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', { idToken: 'gid-1' });
    expect(result).toEqual({ user: { id: 'u1' }, subscription: null });
    expect(mockSetTokenGetter).toHaveBeenCalledWith(expect.any(Function));
  });

  it('eşzamanlı istekler tek getTokens çağrısını paylaşır (single-flight)', async () => {
    GoogleSignin.getTokens.mockResolvedValue({ idToken: 'gid-shared' });
    mockedApi.post.mockResolvedValueOnce({ data: { user: {}, subscription: null } });
    await signInWithGoogle();

    const tokenGetter = mockSetTokenGetter.mock.calls[0][0];
    GoogleSignin.getTokens.mockClear();
    let resolveTokens: (v: any) => void;
    GoogleSignin.getTokens.mockReturnValueOnce(new Promise((r) => { resolveTokens = r; }));

    const p1 = tokenGetter();
    const p2 = tokenGetter(); // devam eden çağrı varken ikinci kez getTokens çağrılmamalı
    resolveTokens!({ idToken: 'gid-new' });

    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBe('gid-new');
    expect(t2).toBe('gid-new');
    expect(GoogleSignin.getTokens).toHaveBeenCalledTimes(1);
  });

  // v13+ : iptal artık hata DEĞİL, { type:'cancelled' } sonucu. Kontrol edilmezse
  // akış getTokens()'a düşer ve anlamsız bir hatayla patlar. v12 davranışını
  // korumak için iptali açık bir hataya çeviriyoruz (LoginScreen bunu yakalıyor).
  it('kullanıcı iptal ederse (type:cancelled) hata fırlatır, backend’e gitmez', async () => {
    GoogleSignin.signIn.mockResolvedValueOnce({ type: 'cancelled', data: null });

    await expect(signInWithGoogle()).rejects.toThrow('iptal');
    expect(GoogleSignin.getTokens).not.toHaveBeenCalled();
    expect(mockedApi.post).not.toHaveBeenCalled();
  });
});

describe('email auth', () => {
  it('registerWithEmail backend token döndürürse SecureStore’a kaydeder', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { token: 'jwt-1', user: { id: 'u1' }, subscription: null } });

    const result = await registerWithEmail('a@b.com', 'pw', 'Ali');

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/register', { email: 'a@b.com', password: 'pw', displayName: 'Ali' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('neareat_auth_token', 'jwt-1');
    expect(result.user).toEqual({ id: 'u1' });
  });

  it('loginWithEmail backend token döndürürse SecureStore’a kaydeder', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { token: 'jwt-2', user: { id: 'u1' }, subscription: null } });

    await loginWithEmail('a@b.com', 'pw');

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/login/email', { email: 'a@b.com', password: 'pw' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('neareat_auth_token', 'jwt-2');
  });
});

describe('signOut', () => {
  it('token siler ve GoogleSignin.signOut çağırır', async () => {
    await signOut();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
    expect(GoogleSignin.signOut).toHaveBeenCalled();
  });

  it('GoogleSignin.signOut hata verirse sessizce yutar', async () => {
    GoogleSignin.signOut.mockRejectedValueOnce(new Error('not configured'));
    await expect(signOut()).resolves.toBeUndefined();
  });
});

describe('diğer auth uçları', () => {
  it('getMe /auth/me çağırır', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { user: {}, subscription: null } });
    await getMe();
    expect(mockedApi.get).toHaveBeenCalledWith('/auth/me');
  });

  it('forgotPassword email ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({});
    await forgotPassword('a@b.com');
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'a@b.com' });
  });

  it('resetPassword token+password ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({});
    await resetPassword('tok', 'newpw');
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/reset-password', { token: 'tok', password: 'newpw' });
  });

  it('verifyEmail token ile POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({});
    await verifyEmail('tok');
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'tok' });
  });

  it('resendVerification parametresiz POST atar', async () => {
    mockedApi.post.mockResolvedValueOnce({});
    await resendVerification();
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/resend-verification');
  });
});

describe('restoreSession — A01 (#451) Google oturumu sessiz geri yükleme', () => {
  it('SecureStore’da JWT varsa (email auth) doğrudan true döner', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('jwt-1');
    const result = await restoreSession();
    expect(result).toBe(true);
    expect(mockSetTokenGetter).toHaveBeenCalledWith(getStoredToken);
  });

  it('JWT yoksa ama Google oturumu cihazda duruyorsa sessizce geri yükler', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce(null);
    GoogleSignin.signInSilently.mockResolvedValueOnce({ type: 'success', data: {} });
    GoogleSignin.getTokens.mockResolvedValueOnce({ idToken: 'gid-1' });

    const result = await restoreSession();

    expect(result).toBe(true);
    expect(mockSetTokenGetter).toHaveBeenCalledWith(expect.any(Function));
  });

  // 🔴 v13+ göçünün EN TEHLİKELİ noktası. v12'de bu durum hata fırlatır, catch'e
  // düşer ve false dönerdi. v13+'ta hata YOK — sonuç objesi dönüyor. Açık kontrol
  // olmasaydı fonksiyon başarı dalında ilerler, getTokens() boş/hatalı döner ve
  // oturum YANLIŞLIKLA geri yüklenmiş sayılırdı. Bu test o sözleşmeyi sabitler.
  it('kayıtlı Google hesabı yoksa (type:noSavedCredentialFound) false döner, token getter AYARLANMAZ', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce(null);
    GoogleSignin.signInSilently.mockResolvedValueOnce({ type: 'noSavedCredentialFound', data: null });

    await expect(restoreSession()).resolves.toBe(false);
    expect(GoogleSignin.getTokens).not.toHaveBeenCalled();
    expect(mockSetTokenGetter).not.toHaveBeenCalled();
  });

  // Gerçek hatalar (ağ kopması, Play Services yok) hâlâ catch'e düşmeli.
  it('signInSilently gerçek bir hata fırlatırsa yine false döner', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce(null);
    GoogleSignin.signInSilently.mockRejectedValueOnce(new Error('network error'));

    await expect(restoreSession()).resolves.toBe(false);
  });

  it('Google idToken boşsa false döner', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce(null);
    GoogleSignin.signInSilently.mockResolvedValueOnce({ type: 'success', data: {} });
    GoogleSignin.getTokens.mockResolvedValueOnce({ idToken: null });

    await expect(restoreSession()).resolves.toBe(false);
  });
});
