import { createContext, use } from 'react';
import type { ThemePreference } from './theme';

export type ThemeContextValue = {
  preference: ThemePreference;
  /** Tema que se ve ahora (resuelve «Sistema»). */
  resolved: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return context;
}
