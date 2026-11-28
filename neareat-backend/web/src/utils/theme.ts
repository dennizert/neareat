// Tema: kayıtlı seçim > sistem tercihi (BILESENLER §1). Depolama erişilemezse sessizce düşer.
export type Theme = 'light' | 'dark';
export const THEME_KEY = 'eatlas-theme';

export function readSavedTheme(): Theme | null {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

export function systemTheme(): Theme {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return systemTheme();
}

export function applySavedTheme(): void {
  const saved = readSavedTheme();
  if (saved) document.documentElement.setAttribute('data-theme', saved);
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  saveTheme(next);
  return next;
}
