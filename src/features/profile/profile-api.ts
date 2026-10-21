import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import type { Avatar } from '@/api/types';
import { forSameSession, SESSION_KEY, useSession } from '@/auth/session';
import { fileBody } from '@/lib/images';

// Con el usuario en la clave: los datos de una cuenta nunca se leen con otra.
export const avatarKey = (userId: string | undefined) => ['me', 'avatar', userId] as const;

// La URL firmada vive 120 s: se renueva un poco antes.
const AVATAR_STALE_MS = 90_000;

export function useMyAvatar() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: avatarKey(session?.user.id),
    queryFn: () => unwrap(api.GET('/api/users/me/avatar')),
    enabled: session?.user.hasAvatar === true,
    staleTime: AVATAR_STALE_MS,
    refetchInterval: AVATAR_STALE_MS,
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  return useMutation({
    mutationFn: (file: File) => unwrap(api.PUT('/api/users/me/avatar', fileBody(file))),
    // La foto de una cuenta nunca queda guardada a nombre de otra.
    ...forSameSession(queryClient, (avatar: Avatar) => {
      queryClient.setQueryData(avatarKey(session?.user.id), avatar);
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    }),
  });
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  return useMutation({
    mutationFn: () => unwrap(api.DELETE('/api/users/me/avatar')),
    ...forSameSession(queryClient, () => {
      queryClient.removeQueries({ queryKey: avatarKey(session?.user.id) });
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    }),
  });
}

export function useChangeEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    // La contraseña actual no queda en la caché de mutaciones (B1 de la fase 3a).
    gcTime: 0,
    mutationFn: (body: { email: string; currentPassword: string }) =>
      unwrap(api.PUT('/api/users/me/email', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () => unwrap(api.POST('/api/auth/verify-email/resend')),
  });
}
