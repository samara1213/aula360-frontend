import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { MyInvitation } from '@/api/types';
import { useSwitchInstitution } from '@/auth/session';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { userTypeLabel } from '@/lib/roles';
import { useAcceptInvitation, useMyInvitations, useRejectInvitation } from './invitations-api';

/**
 * Invitaciones de otras instituciones para entrar con esta misma cuenta. Al
 * aceptar, la institución aparece en el selector y el aviso ofrece entrar ya.
 * Sin invitaciones no se muestra nada.
 */
export function MyInvitations() {
  const { data } = useMyInvitations();
  const accept = useAcceptInvitation();
  const reject = useRejectInvitation();
  const switchInstitution = useSwitchInstitution();
  const [rejecting, setRejecting] = useState<MyInvitation | null>(null);
  if (!data || data.length === 0) return null;

  const enter = (institutionId: string) => {
    switchInstitution.mutate(institutionId, {
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <Section
      title="Invitaciones"
      description="Otras instituciones te invitan a entrar con tu misma cuenta."
    >
      <ul aria-label="Invitaciones" className="flex flex-col divide-y divide-border">
        {data.map((invitation) => {
          const name = invitation.institution.name;
          const busy = accept.isPending || reject.isPending;
          return (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="font-bold break-words">{name}</p>
                <p className="text-sm text-muted-foreground">
                  Como {userTypeLabel(invitation.profileType).toLowerCase()}
                  {invitation.campus ? ` en ${invitation.campus.name}` : ''}. Vence el{' '}
                  {formatDate(invitation.expiresAt)}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() => {
                    accept.mutate(invitation.id, {
                      onSuccess: ({ institutionId }) => {
                        toast.success(`Ya perteneces a ${name}.`, {
                          action: {
                            label: 'Entrar',
                            onClick: () => {
                              enter(institutionId);
                            },
                          },
                        });
                      },
                      onError: (err) => toast.error(errorMessage(err)),
                    });
                  }}
                >
                  <Check aria-hidden="true" />
                  Aceptar <span className="sr-only">la invitación de {name}</span>
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setRejecting(invitation);
                  }}
                >
                  <X aria-hidden="true" />
                  Rechazar <span className="sr-only">la invitación de {name}</span>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
        title={`¿Rechazar la invitación de ${rejecting?.institution.name ?? ''}?`}
        description="Ya no la podrás aceptar. Si cambias de opinión, pide a la institución una nueva."
        confirmLabel="Rechazar invitación"
        pendingLabel="Rechazando…"
        destructive
        pending={reject.isPending}
        onConfirm={() => {
          if (!rejecting) return;
          reject.mutate(rejecting.id, {
            onSuccess: () => {
              toast.success(`Rechazaste la invitación de ${rejecting.institution.name}.`);
              setRejecting(null);
            },
            onError: (err) => {
              toast.error(errorMessage(err));
              setRejecting(null);
            },
          });
        }}
      />
    </Section>
  );
}
