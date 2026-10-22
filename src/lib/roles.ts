/** Nombre para mostrar de los roles globales (el backend usa códigos). */
const GLOBAL_ROLE_LABELS: Record<string, string> = {
  INSTITUTION_ADMIN: 'Administrador de la institución',
  TEACHER: 'Docente',
  STUDENT: 'Estudiante',
};

export function roleLabel(role: { name: string; isGlobal: boolean }): string {
  if (role.isGlobal && Object.hasOwn(GLOBAL_ROLE_LABELS, role.name)) {
    return GLOBAL_ROLE_LABELS[role.name] ?? role.name;
  }
  return role.name;
}

export const USER_TYPE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Administración general',
  INSTITUTION_ADMIN: 'Administrativo',
  TEACHER: 'Docente',
  STUDENT: 'Estudiante',
};

export function userTypeLabel(userType: string): string {
  return Object.hasOwn(USER_TYPE_LABELS, userType)
    ? (USER_TYPE_LABELS[userType] ?? userType)
    : userType;
}
