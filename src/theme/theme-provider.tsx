import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  applyTheme,
  readPreference,
  savePreference,
  systemPrefersDark,
  watchSystemTheme,
  type ThemePreference,
} from './theme';
import { ThemeContext, type ThemeContextValue } from './theme-context';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => watchSystemTheme(setSystemDark), []);

  const dark = preference === 'dark' || (preference === 'system' && systemDark);
  useEffect(() => {
    applyTheme(dark);
  }, [dark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved: dark ? 'dark' : 'light',
      setPreference: (next) => {
        savePreference(next);
        setPreferenceState(next);
      },
    }),
    [preference, dark],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
