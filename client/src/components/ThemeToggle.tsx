import { useEffect, useState } from 'react';
import { getTheme, toggleTheme, ThemeName } from '../lib/theme';

export default function ThemeToggle() {
  const [theme, setLocal] = useState<ThemeName>(getTheme());
  useEffect(() => setLocal(getTheme()), []);
  const isNeon = theme === 'neon';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isNeon}
      aria-label={`Switch to ${isNeon ? 'glass' : 'neon'} theme`}
      onClick={() => setLocal(toggleTheme())}
      className="theme-switch"
      data-state={isNeon ? 'on' : 'off'}
    >
      <span className="theme-switch__track" aria-hidden="true">
        <span className="theme-switch__icon theme-switch__icon--sun">
          <SunIcon />
        </span>
        <span className="theme-switch__icon theme-switch__icon--bolt">
          <BoltIcon />
        </span>
        <span className="theme-switch__thumb">
          {isNeon ? <BoltIcon /> : <SunIcon />}
        </span>
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}
