/**
 * Google Identity Services düğmesi (ADR-001 #8). GIS ID token (`credential`) döndürür; kimlik
 * doğrulama backend'de mevcut `verifyGoogleIdToken` ile yapılır (aud = web client ID).
 *
 * GIS kuralı gereği düğmeyi Google çizer (`renderButton`) — prototipteki `.btn-google` görünümü
 * yalnızca betik yüklenirken yer tutucu olarak gösterilir. Betik yüklenemezse (engelleyici, ağ)
 * düğme gizlenir; e-posta girişi etkilenmez.
 */
import { useEffect, useRef, useState } from 'react';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
// Web client ID gizli değildir (mobil `config.ts` ve backend `googleAuth.js` ile aynı varsayılan).
export const GOOGLE_WEB_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ||
  '1088498639612-651fnimrdrpu7h4rqetm8bdrqtoesbk7.apps.googleusercontent.com';

interface GsiId {
  initialize: (opts: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: string; use_fedcm_for_prompt?: boolean }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}
declare global {
  interface Window { google?: { accounts?: { id?: GsiId } } }
}

let loader: Promise<GsiId> | null = null;
export function loadGsi(): Promise<GsiId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (loader) return loader;
  loader = new Promise<GsiId>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('gsi')));
    s.onerror = () => reject(new Error('gsi'));
    document.head.appendChild(s);
  }).catch((e) => {
    loader = null;
    throw e;
  });
  return loader;
}

export function GoogleSignInButton({ onCredential, disabled }: { onCredential: (credential: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let alive = true;
    loadGsi()
      .then((gsi) => {
        if (!alive || !ref.current) return;
        gsi.initialize({
          client_id: GOOGLE_WEB_CLIENT_ID,
          callback: (r) => { if (r.credential) cb.current(r.credential); },
          ux_mode: 'popup',
        });
        const width = Math.min(400, Math.max(200, Math.floor(ref.current.getBoundingClientRect().width) || 320));
        gsi.renderButton(ref.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', locale: 'tr', width });
        setState('ready');
      })
      .catch(() => { if (alive) setState('unavailable'); });
    return () => { alive = false; };
  }, []);

  if (state === 'unavailable') return null;
  return (
    <>
      <div aria-busy={state === 'loading' || undefined} style={{ minHeight: 44, display: 'flex', justifyContent: 'center', pointerEvents: disabled ? 'none' : undefined, opacity: disabled ? 0.6 : undefined }}>
        <div ref={ref} data-testid="gsi-button" style={{ width: '100%', display: 'flex', justifyContent: 'center' }} />
      </div>
      <div className="divider">veya e-posta ile</div>
    </>
  );
}
