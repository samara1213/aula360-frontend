import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import type { ThemePreference } from './theme';

export const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  short: string;
  Icon: LucideIcon;
}[] = [
  { value: 'light', label: 'Tema claro', short: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Tema oscuro', short: 'Oscuro', Icon: Moon },
  { value: 'system', label: 'Usar el tema del sistema', short: 'Sistema', Icon: Monitor },
];
