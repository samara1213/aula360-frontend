import { Dot } from 'lucide-react';
import { MENU_ICONS } from './menu-icons';

export function MenuIcon({ name, className }: { name: string | null; className?: string }) {
  // Object.hasOwn: un nombre como «constructor» no debe salir del prototipo (B5).
  const Icon = name && Object.hasOwn(MENU_ICONS, name) ? (MENU_ICONS[name] ?? Dot) : Dot;
  return <Icon className={className} aria-hidden="true" />;
}
