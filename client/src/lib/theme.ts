export type ThemeName = 'glass' | 'neon';
const KEY = 'mb.theme';

export function getTheme(): ThemeName {
  const v = localStorage.getItem(KEY);
  return v === 'neon' ? 'neon' : 'glass';
}

export function setTheme(theme: ThemeName) {
  localStorage.setItem(KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'neon' ? '#0a0014' : '#f4f5fa',
  );
}

export function initTheme() {
  setTheme(getTheme());
}

export function toggleTheme(): ThemeName {
  const next: ThemeName = getTheme() === 'glass' ? 'neon' : 'glass';
  setTheme(next);
  return next;
}
