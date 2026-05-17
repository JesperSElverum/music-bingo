import { useEffect, useState } from 'react';
import { getTheme, toggleTheme, ThemeName } from '../lib/theme';

export default function ThemeToggle() {
  const [theme, setLocal] = useState<ThemeName>(getTheme());
  useEffect(() => setLocal(getTheme()), []);
  return (
    <button
      type="button"
      className="btn btn-ghost !py-2 !px-3 text-sm"
      onClick={() => setLocal(toggleTheme())}
      aria-label={`Switch to ${theme === 'glass' ? 'neon' : 'glass'} theme`}
    >
      {theme === 'glass' ? 'Glass' : 'Neon'}
      <span className="opacity-60">→</span>
      {theme === 'glass' ? 'Neon' : 'Glass'}
    </button>
  );
}
