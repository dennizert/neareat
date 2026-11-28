/**
 * Oturum durumu. Kaynağı her zaman backend: kalıcı depolama YOK (çerez HttpOnly, CSRF token
 * bellekte). Sayfa yenilenince `bootstrap()` → `GET /api/auth/web/session`.
 */
import { create } from 'zustand';
import * as client from '../api/client';
import type { RestaurantSummary, SessionUser, WebSessionPayload } from '../types';

export type SessionStatus = 'unknown' | 'loading' | 'anonymous' | 'authenticated';
/** Giriş ekranında gösterilecek bilgi (oturum bitti / çıkış yapıldı / başvuru alındı). */
export type SessionNotice = 'expired' | 'loggedOut' | 'applicationReceived' | null;

interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  restaurant: RestaurantSummary | null;
  notice: SessionNotice;
  bootstrap: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  loginGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  /** 401 vb. ile oturumu yerelde düşürür. */
  clear: (notice?: SessionNotice) => void;
  setNotice: (notice: SessionNotice) => void;
  setRestaurant: (r: RestaurantSummary | null) => void;
}

/** Web'e yalnızca RESTAURANT girebilir (Faz 1, FAZ1-ANALIZ §4-1). Backend de reddeder; bu ikinci kat. */
export class WrongRoleError extends Error {
  constructor() {
    super('Bu panel restoran sahipleri ve yöneticiler içindir.');
    this.name = 'WrongRoleError';
  }
}

async function resolve(session: WebSessionPayload | null) {
  if (!session) return { user: null, restaurant: null };
  const restaurant = await client.fetchRestaurantSummary(session);
  return { user: session.user, restaurant };
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'unknown',
  user: null,
  restaurant: null,
  notice: null,

  async bootstrap() {
    if (get().status === 'loading') return;
    set({ status: 'loading' });
    try {
      const session = await client.fetchSession();
      if (!session || session.user.role !== 'RESTAURANT') {
        set({ status: 'anonymous', user: null, restaurant: null });
        return;
      }
      const { user, restaurant } = await resolve(session);
      set({ status: 'authenticated', user, restaurant });
    } catch {
      set({ status: 'anonymous', user: null, restaurant: null });
    }
  },

  async loginEmail(email, password) {
    const session = await client.loginWithPassword(email, password);
    await applyLogin(session);
  },

  async loginGoogle(credential) {
    const session = await client.loginWithGoogle(credential);
    await applyLogin(session);
  },

  async logout() {
    try {
      await client.logout();
    } finally {
      set({ status: 'anonymous', user: null, restaurant: null, notice: 'loggedOut' });
    }
  },

  async logoutAll() {
    try {
      await client.logoutAll();
    } finally {
      set({ status: 'anonymous', user: null, restaurant: null, notice: 'loggedOut' });
    }
  },

  clear(notice = null) {
    client.setCsrfToken(null);
    set({ status: 'anonymous', user: null, restaurant: null, notice });
  },

  setNotice(notice) {
    set({ notice });
  },

  setRestaurant(restaurant) {
    set({ restaurant });
  },
}));

async function applyLogin(session: WebSessionPayload | null) {
  if (!session) throw new Error('Oturum açılamadı. Lütfen tekrar deneyin.');
  if (session.user.role !== 'RESTAURANT') {
    await client.logout().catch(() => {});
    throw new WrongRoleError();
  }
  const { user, restaurant } = await resolve(session);
  useSessionStore.setState({ status: 'authenticated', user, restaurant, notice: null });
}

/** Restoran panelin tamamını görebilir mi? (V2: PENDING/REJECTED yalnızca durum ekranı.) */
export function canUsePanel(restaurant: RestaurantSummary | null): boolean {
  return restaurant?.status === 'APPROVED';
}

/** Girişten sonra dönülecek yol; yalnızca panel içi göreli yollar (açık yönlendirme yok). */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  if (raw.startsWith('/giris') || raw.startsWith('/sifre-sifirla') || raw.startsWith('/kayit')) return null;
  return raw;
}
