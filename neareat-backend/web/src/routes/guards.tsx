import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { canUsePanel, safeReturnPath, useSessionStore } from '../store/sessionStore';

function FullPageLoading() {
  return (
    <main className="auth" id="icerik" aria-busy="true">
      <div role="status" className="subtle">Yükleniyor…</div>
    </main>
  );
}

/** Oturum yoksa her panel yolu `/giris?donus=<yol>`'a gider; girişten sonra o yola dönülür. */
export function RequireSession({ children }: { children: ReactNode }) {
  const status = useSessionStore((s) => s.status);
  const location = useLocation();
  if (status === 'unknown' || status === 'loading') return <FullPageLoading />;
  if (status !== 'authenticated') {
    const from = location.pathname + location.search;
    const q = from && from !== '/' ? `?donus=${encodeURIComponent(from)}` : '';
    return <Navigate to={`/giris${q}`} replace state={{ from }} />;
  }
  return <>{children}</>;
}

/** PENDING/REJECTED restoran panel yollarına giremez → başvuru durumu (FAZ1 §4-7). */
export function RequireApproved({ children }: { children: ReactNode }) {
  const restaurant = useSessionStore((s) => s.restaurant);
  if (!canUsePanel(restaurant)) return <Navigate to="/basvuru-durumu" replace />;
  return <>{children}</>;
}

/** Giriş/başvuru ekranları: zaten oturum varsa panele (veya durum ekranına) yönlendirir. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const status = useSessionStore((s) => s.status);
  const restaurant = useSessionStore((s) => s.restaurant);
  const location = useLocation();
  if (status === 'unknown' || status === 'loading') return <FullPageLoading />;
  if (status === 'authenticated') {
    const back = safeReturnPath(new URLSearchParams(location.search).get('donus'));
    return <Navigate to={canUsePanel(restaurant) ? (back ?? '/') : '/basvuru-durumu'} replace />;
  }
  return <>{children}</>;
}
