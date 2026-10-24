import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import { forSameSession, SESSION_KEY, useSession } from '@/auth/session';
import { isUuid } from '@/lib/ids';

/** La clave lleva a la persona: otra cuenta en el mismo equipo no ve las de esta. */
function useMyInvitationsKey() {
  const { data: session } = useSession();
  return ['my-invitations', session?.user.id] as const;
}

/** Invitaciones de otras instituciones que la persona aún no responde. */
export function useMyInvitations() {
  const key = useMyInvitationsKey();
  return useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.GET('/api/users/me/invitations')),
    enabled: typeof key[1] === 'string',
  });
}

function checkedPath(id: string) {
  if (!isUuid(id)) throw new Error('Invitación inválida');
  return { params: { path: { id } } };
}

/**
 * Al aceptar se recarga la sesión: la institución nueva aparece en el selector
 * (y en «Entrar», que la usa para cambiar de institución).
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const key = useMyInvitationsKey();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/api/users/me/invitations/{id}/accept', checkedPath(id))),
    ...forSameSession(queryClient, async () => {
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      void queryClient.invalidateQueries({ queryKey: key });
    }),
  });
}

export function useRejectInvitation() {
  const queryClient = useQueryClient();
  const key = useMyInvitationsKey();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST('/api/users/me/invitations/{id}/reject', checkedPath(id))),
    ...forSameSession(queryClient, () => queryClient.invalidateQueries({ queryKey: key })),
  });
}
