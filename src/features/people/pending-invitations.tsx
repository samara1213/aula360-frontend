import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { Invitation } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { useCancelInvitation, usePendingInvitations } from './people-api';

/**
 * Invitaciones que la institución envió y siguen sin respuesta: solo el
 * nombre corto («Carlos P.»), la sede y las fechas. Sin pendientes no se
 * muestra nada.
 */
export function PendingInvitations({ kind }: { kind: 'teachers' | 'students' }) {
  const { data } = usePendingInvitations(kind);
  const cancel = useCancelInvitation(kind);
  const [cancelling, setCancelling] = useState<Invitation | null>(null);
  if (!data || data.length === 0) return null;
  return (
    <Section
      title="Invitaciones pendientes"
      description="Personas con cuenta en otra institución: aparecen en la lista cuando aceptan."
    >
      <ul aria-label="Invitaciones pendientes" className="flex flex-col divide-y divide-border">
        {data.map((invitation) => (
          <li
            key={invitation.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="font-bold break-words">{invitation.displayName}</p>
              <p className="text-sm text-muted-foreground">
                {invitation.campus ? `${invitation.campus.name} · ` : ''}
                Enviada el {formatDate(invitation.createdAt)} · vence el{' '}
                {formatDate(invitation.expiresAt)}
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setCancelling(invitation);
              }}
            >
              <X aria-hidden="true" />
              Cancelar <span className="sr-only">la invitación de {invitation.displayName}</span>
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open) setCancelling(null);
        }}
        title={`¿Cancelar la invitación de ${cancelling?.displayName ?? ''}?`}
        description="Ya no la podrá aceptar. Si cambias de opinión, envía una nueva."
        confirmLabel="Cancelar invitación"
        pendingLabel="Cancelando…"
        destructive
        pending={cancel.isPending}
        onConfirm={() => {
          if (!cancelling) return;
          cancel.mutate(cancelling.id, {
            onSuccess: () => {
              toast.success(`Invitación de ${cancelling.displayName} cancelada.`);
              setCancelling(null);
            },
            onError: (err) => {
              toast.error(errorMessage(err));
              setCancelling(null);
            },
          });
        }}
      />
    </Section>
  );
}
