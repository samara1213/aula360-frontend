import {
  Award,
  Book,
  BookOpen,
  Building,
  Calendar,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Contact,
  Dot,
  FileCheck,
  FileDown,
  FileText,
  GraduationCap,
  Key,
  Layers,
  ListTree,
  MapPin,
  Pencil,
  Presentation,
  School,
  Shield,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

// Solo los íconos que usa el menú (importar todo lucide engorda el bundle).
// Los nombres son los de la columna menu_options.icon del backend.
const ICONS: Record<string, LucideIcon> = {
  award: Award,
  book: Book,
  'book-open': BookOpen,
  building: Building,
  calendar: Calendar,
  'calendar-range': CalendarRange,
  'clipboard-check': ClipboardCheck,
  'clipboard-list': ClipboardList,
  contact: Contact,
  'file-check': FileCheck,
  'file-down': FileDown,
  'file-text': FileText,
  'graduation-cap': GraduationCap,
  key: Key,
  layers: Layers,
  'list-tree': ListTree,
  'map-pin': MapPin,
  pencil: Pencil,
  presentation: Presentation,
  school: School,
  shield: Shield,
  'user-plus': UserPlus,
  users: Users,
};

export function MenuIcon({ name, className }: { name: string | null; className?: string }) {
  // Object.hasOwn: un nombre como «constructor» no debe salir del prototipo (B5).
  const Icon = name && Object.hasOwn(ICONS, name) ? (ICONS[name] ?? Dot) : Dot;
  return <Icon className={className} aria-hidden="true" />;
}
