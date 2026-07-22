import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const ThemeContext = createContext(null);

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('nf-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function isOpportunitiesPath(pathname = '') {
  return pathname === '/opportunities' || pathname.startsWith('/opportunities/');
}

export function ThemeProvider({ children }) {
  const location = useLocation();
  const [theme, setTheme] = useState(getInitialTheme);
  const forceLight = isOpportunitiesPath(location.pathname);
  const activeTheme = forceLight ? 'light' : theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
    // Don't overwrite the user's saved preference while opportunities forces light
    if (!forceLight) {
      localStorage.setItem('nf-theme', theme);
    }
  }, [activeTheme, forceLight, theme]);

  const toggleTheme = () => {
    if (forceLight) return;
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider
      value={{ theme: activeTheme, preferredTheme: theme, setTheme, toggleTheme, forceLight }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
