import { useState } from 'react';
import { Icon } from './Icon';
import { currentTheme, toggleTheme } from '../utils/theme';

export function ThemeToggle() {
  const [dark, setDark] = useState(() => currentTheme() === 'dark');
  const label = dark ? 'Açık temaya geç' : 'Koyu temaya geç';
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      data-theme-toggle=""
      aria-pressed={dark}
      aria-label={label}
      title={label}
      onClick={() => setDark(toggleTheme() === 'dark')}
    >
      <span className="ico-moon"><Icon name="moon" /></span>
      <span className="ico-sun"><Icon name="sun" /></span>
    </button>
  );
}
