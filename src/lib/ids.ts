const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Un id de la URL (`/admin/institutions/:id`) antes de pedirlo a la API: si no
 * es un UUID, la página responde «no encontrada» sin consultar (B2 de 3b-1).
 */
export function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID.test(value);
}
