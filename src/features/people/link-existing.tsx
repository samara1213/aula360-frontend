import { MailPlus, UserSearch } from 'lucide-react';
import { errorMessage } from '@/api/errors';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useLinkCandidate, type PersonDocument } from './people-api';

const NOUN = { teachers: 'docente', students: 'estudiante' } as const;

/**
 * Después de un 409 al crear: busca la cuenta por el documento escrito y, si
 * es de alguien de otra institución, le envía una invitación (la acepta o la
 * rechaza al entrar; hasta entonces no se ven sus datos). Antes muestra solo
 * «Carlos P.», para confirmar que es la persona. Va dentro del formulario del
 * alta: sus botones son type="button" (si no, lo enviarían y el alta se
 * repetiría).
 */
export function LinkExistingPanel({
  kind,
  readDocument,
  inviting,
  onInvite,
}: {
  kind: 'teachers' | 'students';
  /** El documento que está escrito en el formulario. */
  readDocument: () => PersonDocument;
  inviting: { isPending: boolean; error: unknown };
  /** Invita con el documento con el que se encontró la cuenta. */
  onInvite: (document: PersonDocument, displayName: string) => void;
}) {
  const candidate = useLinkCandidate(kind);
  const found = candidate.isSuccess
    ? { name: candidate.data.displayName, document: candidate.variables }
    : null;
  return (
    <section
      aria-label="Cuenta existente"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/40 p-4"
    >
      {found ? (
        <>
          <p>
            Encontramos a <strong>{found.name}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            Le enviamos una invitación como {NOUN[kind]}: al entrar a Aula360 con su misma cuenta la
            acepta o la rechaza. Hasta que acepte no verás sus datos; después completas su ficha.
            Los nombres, el correo y el teléfono que escribiste no se usan.
          </p>
          {inviting.error !== null && <Alert variant="error">{errorMessage(inviting.error)}</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={inviting.isPending}
              onClick={() => {
                onInvite(found.document, found.name);
              }}
            >
              <MailPlus aria-hidden="true" />
              {inviting.isPending ? 'Enviando…' : 'Enviar invitación'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={inviting.isPending}
              onClick={() => {
                candidate.reset();
              }}
            >
              No es esta persona
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>
            ¿Ya tiene cuenta en otra institución? Puedes invitarla como {NOUN[kind]} con su misma
            cuenta, buscándola por el documento que escribiste.
          </p>
          {candidate.isError && <Alert variant="error">{errorMessage(candidate.error)}</Alert>}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={candidate.isPending}
            onClick={() => {
              candidate.mutate(readDocument());
            }}
          >
            <UserSearch aria-hidden="true" />
            {candidate.isPending ? 'Buscando…' : 'Buscar su cuenta'}
          </Button>
        </>
      )}
    </section>
  );
}
