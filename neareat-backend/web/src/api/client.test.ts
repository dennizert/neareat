import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import {
  api, classifyAuthError, configureApi, fetchSession, getCsrfToken, getErrorMessage, isCsrfError,
  isSubscriptionRequired, loginWithPassword, logout, setCsrfToken, WEB_SESSION_CONTRACT,
} from './client';
import { axiosError } from '../test/render';

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data?: unknown };
const calls: InternalAxiosRequestConfig[] = [];

function useAdapter(handler: Handler) {
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config);
    const { status, data } = handler(config);
    const response = { data: data ?? null, status, statusText: String(status), headers: {}, config, request: {} };
    if (status >= 200 && status < 300) return response;
    const err = Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, config, response, toJSON: () => ({}) });
    throw err;
  };
  api.defaults.adapter = adapter;
}

const header = (c: InternalAxiosRequestConfig) => c.headers?.get?.(WEB_SESSION_CONTRACT.csrfHeader) ?? (c.headers as Record<string, unknown>)?.[WEB_SESSION_CONTRACT.csrfHeader];

beforeEach(() => {
  calls.length = 0;
  setCsrfToken(null);
  configureApi({});
});
afterEach(() => vi.restoreAllMocks());

describe('istemci yapılandırması', () => {
  it('çerezle gönderir ve /api tabanını kullanır', () => {
    expect(api.defaults.withCredentials).toBe(true);
    expect(api.defaults.baseURL).toBe('/api');
  });
  it('ADR-001 §3 uç yolları ve CSRF başlığı', () => {
    expect(WEB_SESSION_CONTRACT).toMatchObject({
      login: '/auth/web/login', google: '/auth/web/google', session: '/auth/web/session',
      logout: '/auth/web/logout', logoutAll: '/auth/web/logout-all', csrfHeader: 'X-CSRF-Token',
    });
  });
});

describe('CSRF başlığı', () => {
  it('durum değiştiren isteklere token ekler, GET isteğine eklemez', async () => {
    useAdapter(() => ({ status: 200, data: {} }));
    setCsrfToken('tok-1');
    await api.get('/reservations/restaurant');
    await api.put('/reservations/r1/status', { status: 'CONFIRMED' });
    await api.post('/x');
    await api.delete('/y');
    expect(header(calls[0])).toBeFalsy();
    expect(header(calls[1])).toBe('tok-1');
    expect(header(calls[2])).toBe('tok-1');
    expect(header(calls[3])).toBe('tok-1');
  });

  it('oturum yanıtından token okunur', async () => {
    useAdapter(() => ({ status: 200, data: { user: { id: 'u', role: 'RESTAURANT' }, csrfToken: 'from-session', mfa: 'none' } }));
    const s = await fetchSession();
    expect(s?.csrfToken).toBe('from-session');
    expect(getCsrfToken()).toBe('from-session');
  });

  it('oturum yoksa (401) null döner, yönlendirme tetiklenmez', async () => {
    const onUnauthorized = vi.fn();
    configureApi({ onUnauthorized });
    useAdapter(() => ({ status: 401, data: { error: 'Oturum yok' } }));
    await expect(fetchSession()).resolves.toBeNull();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('403 CSRF: oturumu bir kez yeniden çekip isteği yeni token ile tekrarlar', async () => {
    setCsrfToken('stale');
    let n = 0;
    useAdapter((c) => {
      if (c.url === WEB_SESSION_CONTRACT.session) return { status: 200, data: { user: { id: 'u', role: 'RESTAURANT' }, csrfToken: 'fresh', mfa: 'none' } };
      n += 1;
      return n === 1 ? { status: 403, data: { error: 'CSRF doğrulaması başarısız', code: 'CSRF_INVALID' } } : { status: 200, data: { ok: true } };
    });
    const r = await api.post('/restaurant-account/campaign', { message: 'x' });
    expect(r.data).toEqual({ ok: true });
    const posts = calls.filter((c) => c.url === '/restaurant-account/campaign');
    expect(posts).toHaveLength(2);
    expect(header(posts[1])).toBe('fresh');
  });

  it('403 CSRF ikinci kez gelirse sonsuz döngüye girmez, hatayı fırlatır', async () => {
    setCsrfToken('stale');
    useAdapter((c) => (c.url === WEB_SESSION_CONTRACT.session
      ? { status: 200, data: { user: { id: 'u', role: 'RESTAURANT' }, csrfToken: 'fresh', mfa: 'none' } }
      : { status: 403, data: { code: 'CSRF_INVALID' } }));
    await expect(api.post('/x')).rejects.toMatchObject({ response: { status: 403 } });
    expect(calls.filter((c) => c.url === '/x')).toHaveLength(2);
  });

  it('abonelik 403\'ü CSRF sayılmaz, tekrar denenmez', async () => {
    useAdapter(() => ({ status: 403, data: { error: 'Rezervasyon yanıtlamak için aktif aboneliğiniz olmalı.', code: 'SUBSCRIPTION_REQUIRED' } }));
    await expect(api.put('/reservations/1/status')).rejects.toBeTruthy();
    expect(calls).toHaveLength(1);
  });
});

describe('401 davranışı', () => {
  it('korumalı istekte 401 → token temizlenir, onUnauthorized çağrılır', async () => {
    const onUnauthorized = vi.fn();
    configureApi({ onUnauthorized });
    setCsrfToken('t');
    useAdapter(() => ({ status: 401, data: { error: 'Invalid or expired token' } }));
    await expect(api.get('/restaurant-account/me')).rejects.toBeTruthy();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(getCsrfToken()).toBeNull();
  });

  it('giriş denemesindeki 401 yönlendirme tetiklemez', async () => {
    const onUnauthorized = vi.fn();
    configureApi({ onUnauthorized });
    useAdapter(() => ({ status: 401, data: { error: 'E-posta veya şifre hatalı' } }));
    await expect(loginWithPassword('a@b.co', 'x')).rejects.toBeTruthy();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('oturum uçları', () => {
  it('giriş: POST login sonra GET session', async () => {
    useAdapter((c) => (c.url === WEB_SESSION_CONTRACT.login ? { status: 204 } : { status: 200, data: { user: { id: 'u', role: 'RESTAURANT' }, csrfToken: 'c', mfa: 'none' } }));
    const s = await loginWithPassword('a@b.co', 'secret123');
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['post /auth/web/login', 'get /auth/web/session']);
    expect(JSON.parse(calls[0].data as string)).toEqual({ email: 'a@b.co', password: 'secret123' });
    expect(s?.csrfToken).toBe('c');
  });

  it('çıkış CSRF ile gider ve token\'ı siler (hata olsa bile)', async () => {
    setCsrfToken('c1');
    useAdapter(() => ({ status: 500 }));
    await expect(logout()).rejects.toBeTruthy();
    expect(header(calls[0])).toBe('c1');
    expect(getCsrfToken()).toBeNull();
  });
});

describe('hata yardımcıları', () => {
  it('classifyAuthError', () => {
    expect(classifyAuthError(axiosError(401, { error: 'E-posta veya şifre hatalı' }))).toBe('invalid');
    expect(classifyAuthError(axiosError(429, {}))).toBe('locked');
    expect(classifyAuthError(axiosError(403, { error: 'Hesabınız askıya alınmıştır.' }))).toBe('suspended');
    expect(classifyAuthError(axiosError(403, { error: 'Bu panel...', code: 'WEB_ROLE_NOT_ALLOWED' }))).toBe('role');
    expect(classifyAuthError(Object.assign(new Error('net'), { isAxiosError: true }))).toBe('network');
  });
  it('isSubscriptionRequired her iki kodu tanır', () => {
    expect(isSubscriptionRequired(axiosError(403, { code: 'SUBSCRIPTION_REQUIRED' }))).toBe(true);
    expect(isSubscriptionRequired(axiosError(403, { code: 'PREMIUM_REQUIRED' }))).toBe(true);
    expect(isSubscriptionRequired(axiosError(403, { code: 'LEVEL_REQUIRED' }))).toBe(false);
  });
  it('getErrorMessage backend metnini aynen verir', () => {
    expect(getErrorMessage(axiosError(400, { error: 'Red nedeni zorunludur' }))).toBe('Red nedeni zorunludur');
    expect(getErrorMessage(axiosError(429, { error: 'CAMPAIGN_LIMIT_EXCEEDED', message: 'Bugün zaten bir kampanya gönderdiniz.' }))).toBe('Bugün zaten bir kampanya gönderdiniz.');
    expect(getErrorMessage(axiosError(403, { code: 'CSRF_INVALID' }))).toMatch(/Sayfayı yenileyip/);
  });
  it('isCsrfError', () => {
    expect(isCsrfError(403, { code: 'CSRF_INVALID' })).toBe(true);
    expect(isCsrfError(403, { code: 'ORIGIN_INVALID' })).toBe(true);
    expect(isCsrfError(403, { error: 'Hesabınız askıya alınmıştır.' })).toBe(false);
    expect(isCsrfError(403, { code: 'SUBSCRIPTION_REQUIRED' })).toBe(false);
    expect(isCsrfError(400, { code: 'CSRF' })).toBe(false);
  });
});
