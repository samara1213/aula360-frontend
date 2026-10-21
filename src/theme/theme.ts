export type ThemePreference = 'light' | 'dark' | 'system';

// La misma clave y la misma lógica que el script de index.html (anti-parpadeo).
export const THEME_STORAGE_KEY = 'aula360.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function savePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Sin almacenamiento (modo privado): el tema dura hasta recargar.
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

/** Avisa cuando cambia el tema del sistema; devuelve la función para dejar de escuchar. */
export function watchSystemTheme(listener: (dark: boolean) => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const handler = (event: MediaQueryListEvent) => {
    listener(event.matches);
  };
  media.addEventListener('change', handler);
  return () => {
    media.removeEventListener('change', handler);
  };
}
