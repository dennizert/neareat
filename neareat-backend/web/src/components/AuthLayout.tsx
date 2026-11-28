import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

/** Giriş düzeni (BILESENLER §2): `.auth > .auth-card > .auth-head + .card + .auth-foot`. */
export function AuthLayout({ title, subtitle, children, foot, wide }: { title: string; subtitle?: ReactNode; children: ReactNode; foot?: ReactNode; wide?: boolean }) {
  return (
    <>
      <div className="theme-float"><ThemeToggle /></div>
      <main className="auth" id="icerik">
        <div className={`auth-card${wide ? ' wide' : ''}`}>
          <div className="auth-head">
            <span className="logo logo-lg" role="img" aria-label="Eatlas">Eatlas</span>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="card">{children}</div>
          {foot && <p className="auth-foot">{foot}</p>}
        </div>
      </main>
    </>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
