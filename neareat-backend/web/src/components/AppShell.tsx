import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { ThemeToggle } from './ThemeToggle';
import { ConfirmDialog } from './Dialog';
import { useSessionStore } from '../store/sessionStore';
import { useCountsStore } from '../store/countsStore';
import { toast } from '../store/toastStore';
import { initials } from '../utils/format';

interface NavItem { to: string; label: string; icon: string; badge?: 'pending' }
interface NavGroup { title: string; items: NavItem[] }

/** #531: Genel / İşletme / Büyüme / Hesap grupları. */
export const NAV_GROUPS: NavGroup[] = [
  { title: 'Genel', items: [
    { to: '/', label: 'Genel bakış', icon: 'home' },
    { to: '/rezervasyonlar', label: 'Rezervasyonlar', icon: 'calendar', badge: 'pending' },
    { to: '/doluluk', label: 'Doluluk', icon: 'gauge' },
  ] },
  { title: 'İşletme', items: [
    { to: '/bilgiler', label: 'Bilgiler', icon: 'store' },
    { to: '/saatler', label: 'Saatler', icon: 'clock' },
    { to: '/menu', label: 'Menü', icon: 'book' },
    { to: '/fotograflar', label: 'Fotoğraflar', icon: 'image' },
  ] },
  { title: 'Büyüme', items: [
    { to: '/yorumlar', label: 'Yorumlar', icon: 'star' },
    { to: '/indirim', label: 'İndirim', icon: 'tag' },
    { to: '/kampanya', label: 'Kampanya', icon: 'megaphone' },
    { to: '/analitik', label: 'Analitik', icon: 'trend' },
  ] },
];

const UNREAD_POLL_MS = 60_000;

export function AppShell({ children }: { children?: ReactNode }) {
  const restaurant = useSessionStore((s) => s.restaurant);
  const logout = useSessionStore((s) => s.logout);
  const logoutAll = useSessionStore((s) => s.logoutAll);
  const { pending, unread, refreshPending, refreshUnread, reset } = useCountsStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const name = restaurant?.displayName || restaurant?.businessName || 'Restoran';

  useEffect(() => {
    refreshPending();
    refreshUnread();
    const t = window.setInterval(refreshUnread, UNREAD_POLL_MS);
    return () => window.clearInterval(t);
  }, [refreshPending, refreshUnread]);

  const closeDrawer = useCallback((returnFocus = true) => {
    setDrawerOpen(false);
    if (returnFocus) menuBtnRef.current?.focus();
  }, []);

  // Sayfa değişince çekmece kapanır (odak içeriğe gider, hamburger'e değil).
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    sidebarRef.current?.querySelector<HTMLElement>('.nav-link')?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeDrawer(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  async function doLogout(all: boolean) {
    setBusy(true);
    try {
      if (all) await logoutAll(); else await logout();
    } catch {
      // backend erişilemese bile yerel oturum düşürüldü (store finally)
    } finally {
      setBusy(false);
      setConfirmAll(false);
      reset();
      if (all) toast('Tüm cihazlardaki web oturumlarınız kapatıldı.', 'success');
      navigate('/giris', { replace: true });
    }
  }

  return (
    <>
      <a className="skip-link" href="#icerik">İçeriğe atla</a>
      <div className="app" data-drawer={drawerOpen ? 'open' : undefined}>
        <aside className="sidebar" id="yan-menu" aria-label="Ana menü" ref={sidebarRef}>
          <div className="sidebar-brand">
            <div>
              <NavLink className="logo" to="/" aria-label="Eatlas ana sayfa">Eatlas</NavLink>
              <span className="role">Restoran Paneli</span>
            </div>
            <button type="button" className="btn btn-ghost btn-icon close-btn" aria-label="Menüyü kapat" onClick={() => closeDrawer()}>
              <Icon name="x" />
            </button>
          </div>
          <nav aria-label="Panel">
            {NAV_GROUPS.map((g) => (
              <div className="nav-group" key={g.title}>
                <div className="nav-group-title" id={`ng-${g.title}`}>{g.title}</div>
                <ul role="list" aria-labelledby={`ng-${g.title}`} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {g.items.map((it) => (
                    <li key={it.to}>
                      <NavLink className="nav-link" to={it.to} end={it.to === '/'}>
                        <Icon name={it.icon} />
                        <span>{it.label}</span>
                        {it.badge === 'pending' && pending ? (
                          <span className="badge badge-danger no-dot" aria-label={`${pending} bekleyen`}>{pending}</span>
                        ) : null}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="nav-group">
              <div className="nav-group-title" id="ng-Hesap">Hesap</div>
              <ul role="list" aria-labelledby="ng-Hesap" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                <li>
                  <button type="button" className="nav-link" onClick={() => setConfirmAll(true)}>
                    <Icon name="shield" /><span>Tüm cihazlardan çıkış</span>
                  </button>
                </li>
              </ul>
            </div>
          </nav>
          <div className="sidebar-foot">
            <button type="button" className="nav-link" onClick={() => doLogout(false)} aria-busy={busy || undefined}>
              <Icon name="logout" /><span>Çıkış</span>
            </button>
          </div>
        </aside>
        <div className="drawer-backdrop" onClick={() => closeDrawer()} />
        <div className="main">
          <header className="topbar">
            <button
              ref={menuBtnRef}
              type="button"
              className="btn btn-ghost btn-icon menu-btn"
              aria-controls="yan-menu"
              aria-expanded={drawerOpen}
              aria-label="Menüyü aç"
              onClick={() => setDrawerOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="topbar-title">{name}</span>
            <div className="topbar-actions">
              <ThemeToggle />
              <NavLink
                to="/bildirimler"
                className="btn btn-ghost btn-icon bell"
                aria-label={unread ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
              >
                <Icon name="bell" />
                {unread ? (
                  <span className="badge badge-danger no-dot" aria-hidden="true">
                    {unread > 99 ? '99+' : unread}
                  </span>
                ) : null}
              </NavLink>
              <span className="avatar" title={name} aria-hidden="true">{initials(name)}</span>
            </div>
          </header>
          <main className="content" id="icerik" tabIndex={-1}>
            {children ?? <Outlet />}
          </main>
        </div>
      </div>
      <ConfirmDialog
        open={confirmAll}
        title="Tüm cihazlardan çıkış"
        message="Bu hesapla açık olan bütün web oturumları kapatılacak. Mobil uygulamadaki oturumunuz etkilenmez."
        confirmLabel="Hepsinden çıkış yap"
        tone="danger"
        busy={busy}
        onConfirm={() => doLogout(true)}
        onClose={() => setConfirmAll(false)}
      />
    </>
  );
}
