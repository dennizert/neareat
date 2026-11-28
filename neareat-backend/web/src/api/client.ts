/**
 * API katmanı — web paneli ile backend arasındaki TEK sözleşme noktası.
 *
 * Web oturumu (ADR-001 §1 #4-#5, §3): opak oturum kimliği `__Host-eatlas_sid` çerezinde
 * (HttpOnly → JS göremez), CSRF token'ı `GET /api/auth/web/session` yanıtından okunur ve
 * durum değiştiren her isteğe `X-CSRF-Token` başlığıyla eklenir. Token bellekte tutulur,
 * hiçbir yerde saklanmaz (localStorage XSS'e açık — ADR #4 gerekçesi).
 *
 * Sözleşme kaynağı: PR #534 (`routes/webAuth.js`, `middleware/webSession.js`). Uç yolları,
 * başlık adı ve hata kodları BİLEREK bu dosyada toplandı: sapma olursa yalnızca burası değişir.
 * Hata kodları: 401 `WEB_SESSION_INVALID` (→ giriş), 403 `CSRF_INVALID` / `ORIGIN_INVALID`
 * (→ oturumu yeniden çek, bir kez tekrar dene), 403 `{error:'Hesabınız askıya alınmıştır.'}`.
 * Yanlış rol (USER/ADMIN) backend'de hatalı kimlikle AYNI 401 genel mesajını alır (sızıntı yok).
 */
import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { RestaurantSummary, WebSessionPayload } from '../types';

export const API_BASE_URL = '/api';

/** ADR-001 §3 sözleşmesi. Değişirse yalnız burası güncellenir. */
export const WEB_SESSION_CONTRACT = {
  login: '/auth/web/login',
  google: '/auth/web/google',
  session: '/auth/web/session',
  logout: '/auth/web/logout',
  logoutAll: '/auth/web/logout-all',
  csrfHeader: 'X-CSRF-Token',
} as const;

/**
 * 401 dönmesi "oturum yok/bitti" anlamına GELMEYEN uçlar: giriş denemesi, oturum sorgusu,
 * şifre sıfırlama, başvuru. Bunlarda 401 global yönlendirmeyi tetiklemez; çağıran ele alır.
 */
const AUTH_FLOW_PATHS = [
  WEB_SESSION_CONTRACT.login,
  WEB_SESSION_CONTRACT.google,
  WEB_SESSION_CONTRACT.session,
  '/auth/forgot-password',
  '/auth/reset-password',
  '/restaurant-account/register',
];

const SAFE_METHODS = ['get', 'head', 'options'];

// ─── Modül durumu ────────────────────────────────────────────────────────────

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}
export function getCsrfToken(): string | null {
  return csrfToken;
}

interface ApiHooks {
  /** Korumalı bir istek 401 aldığında (oturum bitti / başka sekmede çıkış yapıldı). */
  onUnauthorized?: () => void;
}
let hooks: ApiHooks = {};
export function configureApi(next: ApiHooks): void {
  hooks = next;
}

// ─── İstemci ─────────────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20000,
  headers: { Accept: 'application/json' },
});

function pathOf(config: AxiosRequestConfig | undefined): string {
  const url = config?.url ?? '';
  return url.startsWith(API_BASE_URL) ? url.slice(API_BASE_URL.length) : url;
}

function isAuthFlowPath(config: AxiosRequestConfig | undefined): boolean {
  const p = pathOf(config).split('?')[0];
  return AUTH_FLOW_PATHS.includes(p);
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (!SAFE_METHODS.includes(method) && csrfToken) {
    config.headers.set(WEB_SESSION_CONTRACT.csrfHeader, csrfToken);
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean };

export const CSRF_ERROR_CODES = ['CSRF_INVALID', 'ORIGIN_INVALID'];
export const SESSION_INVALID_CODE = 'WEB_SESSION_INVALID';

/**
 * 403'ün CSRF/Origin reddi olup olmadığı (#534: `CSRF_INVALID` / `ORIGIN_INVALID`). Abonelik/
 * seviye 403'leri (`SUBSCRIPTION_REQUIRED` vb.) ve askı 403'ü bununla karışmaz.
 */
export function isCsrfError(status: number | undefined, body: unknown): boolean {
  if (status !== 403 || !body || typeof body !== 'object') return false;
  const b = body as { code?: unknown; error?: unknown };
  const code = typeof b.code === 'string' ? b.code : '';
  const error = typeof b.error === 'string' ? b.error : '';
  return CSRF_ERROR_CODES.includes(code) || /csrf/i.test(code) || /csrf/i.test(error);
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const body = error.response?.data;

    // 403 CSRF: oturum bilgisini BİR KEZ yeniden çek (token döner) ve isteği tekrarla.
    if (config && isCsrfError(status, body) && !config._csrfRetried) {
      config._csrfRetried = true;
      try {
        const fresh = await fetchSession();
        if (fresh) {
          config.headers.set(WEB_SESSION_CONTRACT.csrfHeader, fresh.csrfToken);
          return api.request(config);
        }
      } catch {
        // yeniden çekme başarısız → özgün hata aşağıda fırlatılır
      }
    }

    if (status === 401 && !isAuthFlowPath(config)) {
      setCsrfToken(null);
      hooks.onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

// ─── Hata yardımcıları ───────────────────────────────────────────────────────

export function getStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

export function getErrorBody(err: unknown): Record<string, unknown> | undefined {
  if (!axios.isAxiosError(err)) return undefined;
  const d = err.response?.data;
  return d && typeof d === 'object' ? (d as Record<string, unknown>) : undefined;
}

export function getErrorCode(err: unknown): string | undefined {
  const b = getErrorBody(err);
  return typeof b?.code === 'string' ? b.code : undefined;
}

/** Backend `{ error }` / `{ message }` metnini aynen döndürür (mobil ile aynı metin kuralı). */
export function getErrorMessage(err: unknown, fallback = 'Bir hata oluştu. Lütfen tekrar deneyin.'): string {
  if (axios.isAxiosError(err) && !err.response) {
    return 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.';
  }
  if (isCsrfError(getStatus(err), getErrorBody(err))) {
    return 'Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.';
  }
  const b = getErrorBody(err);
  if (typeof b?.message === 'string' && b.message && typeof b?.error === 'string' && /^[A-Z_]+$/.test(b.error)) {
    return b.message; // ör. { error: 'CAMPAIGN_LIMIT_EXCEEDED', message: '...' }
  }
  if (typeof b?.error === 'string' && b.error) return b.error;
  if (typeof b?.message === 'string' && b.message) return b.message;
  return fallback;
}

/** S19-1: restoran işlem kapısı. Mobil `premiumGate.isPremiumRequired` iki kodu da tanır. */
export function isSubscriptionRequired(err: unknown): boolean {
  const code = getErrorCode(err);
  return getStatus(err) === 403 && (code === 'SUBSCRIPTION_REQUIRED' || code === 'PREMIUM_REQUIRED');
}

// ─── Web oturumu (ADR-001 §3) ────────────────────────────────────────────────

/** `GET /api/auth/web/session`. Oturum yoksa (401) `null`. CSRF token'ını modüle yazar. */
export async function fetchSession(): Promise<WebSessionPayload | null> {
  try {
    const { data } = await api.get<WebSessionPayload>(WEB_SESSION_CONTRACT.session);
    setCsrfToken(data?.csrfToken ?? null);
    return data;
  } catch (err) {
    if (getStatus(err) === 401) {
      setCsrfToken(null);
      return null;
    }
    throw err;
  }
}

/** `POST /api/auth/web/login` (204 + Set-Cookie) → ardından oturum bilgisi. */
export async function loginWithPassword(email: string, password: string): Promise<WebSessionPayload | null> {
  await api.post(WEB_SESSION_CONTRACT.login, { email, password });
  return fetchSession();
}

/** `POST /api/auth/web/google` — GIS `credential` (Google ID token). */
export async function loginWithGoogle(credential: string): Promise<WebSessionPayload | null> {
  await api.post(WEB_SESSION_CONTRACT.google, { credential });
  return fetchSession();
}

export async function logout(): Promise<void> {
  try {
    await api.post(WEB_SESSION_CONTRACT.logout);
  } finally {
    setCsrfToken(null);
  }
}

export async function logoutAll(): Promise<void> {
  try {
    await api.post(WEB_SESSION_CONTRACT.logoutAll);
  } finally {
    setCsrfToken(null);
  }
}

/** Oturumdaki restoranın onay durumu. Session yanıtında yoksa `/restaurant-account/me`. */
export async function fetchRestaurantSummary(session: WebSessionPayload): Promise<RestaurantSummary | null> {
  if (session.user.role !== 'RESTAURANT') return null;
  if (session.restaurantProfile) return session.restaurantProfile;
  const { data } = await api.get<RestaurantSummary>('/restaurant-account/me');
  return {
    status: data.status,
    rejectionReason: data.rejectionReason ?? null,
    businessName: data.businessName,
    displayName: data.displayName ?? null,
  };
}

export type AuthErrorKind = 'invalid' | 'role' | 'suspended' | 'locked' | 'network' | 'unknown';

/**
 * Giriş hatasını ekran durumuna çevirir (#534): 401 → hatalı kimlik (yanlış rol dahil, backend
 * bilinçli olarak ayırt etmez); 403 askı mesajı → askıya alınmış; diğer 403 → yanlış rol;
 * 429 → rate limit (authLimiter).
 */
export function classifyAuthError(err: unknown): AuthErrorKind {
  if (axios.isAxiosError(err) && !err.response) return 'network';
  const status = getStatus(err);
  const body = getErrorBody(err);
  const code = typeof body?.code === 'string' ? body.code : '';
  const msg = typeof body?.error === 'string' ? body.error : '';
  if (status === 429) return 'locked';
  if (status === 401) return 'invalid';
  if (status === 403) {
    if (/suspend/i.test(code) || /askıya/i.test(msg)) return 'suspended';
    return 'role';
  }
  return 'unknown';
}

export default api;
