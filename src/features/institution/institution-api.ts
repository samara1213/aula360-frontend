import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import type {
  CreateCampusBody,
  CreateInstitutionBody,
  Institution,
  UpdateCampusBody,
  UpdateInstitutionBody,
} from '@/api/types';
import { forSameSession, useSession } from '@/auth/session';
import { isUuid } from '@/lib/ids';
import { fileBody } from '@/lib/images';

type ListQuery = { page: number; limit: number; search?: string; isActive?: boolean };

// ─── Institución activa ────────────────────────────────────────────────────

// Con la institución en la clave: los datos de una nunca se leen con otra.
const currentKey = (institutionId: string | null | undefined) =>
  ['institution', 'current', institutionId] as const;

export function useCurrentInstitution() {
  const { data: session } = useSession();
  const active = session?.activeInstitutionId;
  return useQuery({
    queryKey: currentKey(active),
    queryFn: () => unwrap(api.GET('/api/institutions/current')),
    enabled: typeof active === 'string',
  });
}

/** Logo de la institución activa (subir o quitar). */
export function useCurrentLogo() {
  const queryClient = useQueryClient();
  // Con el id de la respuesta, y solo si la sesión sigue en la misma
  // institución: los datos de una nunca quedan guardados como los de otra.
  const store = forSameSession(queryClient, (institution: Institution) => {
    queryClient.setQueryData(currentKey(institution.id), institution);
  });
  const upload = useMutation({
    mutationFn: (file: File) => unwrap(api.PUT('/api/institutions/current/logo', fileBody(file))),
    ...store,
  });
  const remove = useMutation({
    mutationFn: () => unwrap(api.DELETE('/api/institutions/current/logo')),
    ...store,
  });
  return { upload, remove };
}

// ─── Sedes ─────────────────────────────────────────────────────────────────

/**
 * Sedes de la institución activa (`/campuses`) o de una institución cualquiera
 * para el SUPER_ADMIN (`/institutions/:id/campuses`).
 */
export type CampusScope = { kind: 'institution' } | { kind: 'system'; institutionId: string };

const ACTIVE: CampusScope = { kind: 'institution' };

/** Con la institución en la clave: las sedes de una nunca se leen con otra. */
function useCampusesKey(scope: CampusScope) {
  const { data: session } = useSession();
  return scope.kind === 'system'
    ? (['admin', 'campuses', scope.institutionId] as const)
    : (['campuses', session?.activeInstitutionId] as const);
}

export function useCampuses(
  query: ListQuery,
  { enabled = true, scope = ACTIVE }: { enabled?: boolean; scope?: CampusScope } = {},
) {
  const { data: session } = useSession();
  const key = useCampusesKey(scope);
  const ready = scope.kind === 'system' || typeof session?.activeInstitutionId === 'string';
  return useQuery({
    queryKey: [...key, query],
    queryFn: () =>
      unwrap(
        scope.kind === 'system'
          ? api.GET('/api/institutions/{institutionId}/campuses', {
              params: { path: { institutionId: scope.institutionId }, query },
            })
          : api.GET('/api/campuses', { params: { query } }),
      ),
    enabled: enabled && ready,
    // Los datos anteriores mientras carga otra página, solo de la misma
    // institución (B4 de 3b-1): nunca las sedes de otra como marcador.
    placeholderData: (previous, previousQuery) =>
      key.every((part, index) => previousQuery?.queryKey[index] === part) ? previous : undefined,
  });
}

/**
 * Una sede nueva, editada o desactivada cambia lo que muestran sus selectores y
 * los usuarios y personas con rol en ella: se recarga todo, en los dos alcances
 * (el SUPER_ADMIN puede estar editando su propia institución activa). B4 de la 3c.
 */
const CAMPUS_DEPENDENTS = [
  ['campuses'],
  ['admin', 'campuses'],
  ['users'],
  ['admin', 'institution-users'],
  ['role-assignments'],
  ['admin', 'role-assignments'],
  ['people'],
] as const;

function useInvalidateCampuses() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(CAMPUS_DEPENDENTS.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useCreateCampus(scope: CampusScope = ACTIVE) {
  const invalidate = useInvalidateCampuses();
  return useMutation({
    mutationFn: (body: CreateCampusBody) =>
      unwrap(
        scope.kind === 'system'
          ? api.POST('/api/institutions/{institutionId}/campuses', {
              params: { path: { institutionId: scope.institutionId } },
              body,
            })
          : api.POST('/api/campuses', { body }),
      ),
    onSuccess: invalidate,
  });
}

export function useUpdateCampus(scope: CampusScope = ACTIVE) {
  const invalidate = useInvalidateCampuses();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCampusBody }) =>
      unwrap(
        scope.kind === 'system'
          ? api.PATCH('/api/institutions/{institutionId}/campuses/{id}', {
              params: { path: { institutionId: scope.institutionId, id } },
              body,
            })
          : api.PATCH('/api/campuses/{id}', { params: { path: { id } }, body }),
      ),
    onSuccess: invalidate,
  });
}

export function useSetCampusActive(scope: CampusScope = ACTIVE) {
  const invalidate = useInvalidateCampuses();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => {
      if (scope.kind === 'system') {
        const path = { institutionId: scope.institutionId, id };
        return unwrap(
          active
            ? api.PATCH('/api/institutions/{institutionId}/campuses/{id}/activate', {
                params: { path },
              })
            : api.PATCH('/api/institutions/{institutionId}/campuses/{id}/deactivate', {
                params: { path },
              }),
        );
      }
      return unwrap(
        active
          ? api.PATCH('/api/campuses/{id}/activate', { params: { path: { id } } })
          : api.PATCH('/api/campuses/{id}/deactivate', { params: { path: { id } } }),
      );
    },
    onSuccess: invalidate,
  });
}

// ─── Todas las instituciones (SUPER_ADMIN) ──────────────────────────────────

const INSTITUTIONS_KEY = ['admin', 'institutions'] as const;
const institutionKey = (id: string) => [...INSTITUTIONS_KEY, 'detail', id] as const;

export function useInstitutions(query: ListQuery) {
  return useQuery({
    queryKey: [...INSTITUTIONS_KEY, 'list', query],
    queryFn: () => unwrap(api.GET('/api/institutions', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useInstitution(id: string) {
  return useQuery({
    queryKey: institutionKey(id),
    queryFn: () => unwrap(api.GET('/api/institutions/{id}', { params: { path: { id } } })),
    enabled: isUuid(id),
  });
}

/**
 * Tras cambiar una institución: el detalle con la respuesta y los listados a
 * recargar (si la sesión sigue siendo la misma).
 */
function useStoreInstitution() {
  const queryClient = useQueryClient();
  return forSameSession(queryClient, (institution: Institution) => {
    queryClient.setQueryData(institutionKey(institution.id), institution);
    void queryClient.invalidateQueries({ queryKey: [...INSTITUTIONS_KEY, 'list'] });
  });
}

export function useCreateInstitution() {
  const store = useStoreInstitution();
  return useMutation({
    mutationFn: (body: CreateInstitutionBody) => unwrap(api.POST('/api/institutions', { body })),
    ...store,
  });
}

export function useUpdateInstitution(id: string) {
  const store = useStoreInstitution();
  return useMutation({
    mutationFn: (body: UpdateInstitutionBody) =>
      unwrap(api.PATCH('/api/institutions/{id}', { params: { path: { id } }, body })),
    ...store,
  });
}

export function useSetInstitutionActive(id: string) {
  const store = useStoreInstitution();
  return useMutation({
    mutationFn: (active: boolean) =>
      unwrap(
        active
          ? api.PATCH('/api/institutions/{id}/activate', { params: { path: { id } } })
          : api.PATCH('/api/institutions/{id}/deactivate', { params: { path: { id } } }),
      ),
    ...store,
  });
}

export function useInstitutionLogo(id: string) {
  const store = useStoreInstitution();
  const upload = useMutation({
    mutationFn: (file: File) =>
      unwrap(
        api.PUT('/api/institutions/{id}/logo', { params: { path: { id } }, ...fileBody(file) }),
      ),
    ...store,
  });
  const remove = useMutation({
    mutationFn: () =>
      unwrap(api.DELETE('/api/institutions/{id}/logo', { params: { path: { id } } })),
    ...store,
  });
  return { upload, remove };
}
