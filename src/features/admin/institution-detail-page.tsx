import { ChevronLeft, Power, PowerOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '@/api/errors';
import type { Institution } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useInstitution,
  useInstitutionLogo,
  useSetInstitutionActive,
  useUpdateInstitution,
} from '@/features/institution/institution-api';
import { LogoEditor } from '@/features/institution/institution-logo';
import { PageHeader } from '@/features/layout/page-header';
import { NotFoundPage } from '@/features/layout/status-pages';
import { isUuid } from '@/lib/ids';
import { InstitutionForm } from './institution-form';

/** /admin/institutions/:id: datos, logo y estado de una institución (SUPER_ADMIN). */
export function InstitutionDetailPage() {
  const { id = '' } = useParams();
  const { data: institution, isPending, error, refetch } = useInstitution(id);

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/admin/institutions"
        className="inline-flex min-h-11 items-center gap-1 self-start rounded-md font-bold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/25"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
        Instituciones
      </Link>
      {!isUuid(id) ? (
        <NotFoundPage />
      ) : isPending ? (
        <div className="flex flex-col gap-6" aria-busy="true">
          <Skeleton className="h-10 w-2/3 max-w-md" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : error ? (
        // 404 o un id con formato inválido (400): la misma página de «no encontrada».
        error instanceof ApiError && (error.status === 404 || error.status === 400) ? (
          <NotFoundPage />
        ) : (
          <Alert variant="error">
            No pudimos cargar la institución.{' '}
            <button
              type="button"
              className="cursor-pointer font-bold text-primary underline"
              onClick={() => void refetch()}
            >
              Reintentar
            </button>
          </Alert>
        )
      ) : (
        <InstitutionDetail key={institution.id} institution={institution} />
      )}
    </div>
  );
}

function InstitutionDetail({ institution }: { institution: Institution }) {
  const update = useUpdateInstitution(institution.id);
  const setActive = useSetInstitutionActive(institution.id);
  const logo = useInstitutionLogo(institution.id);
  const [confirming, setConfirming] = useState(false);
  const { isActive, name } = institution;

  return (
    <>
      <PageHeader
        title={name}
        description={<StatusBadge active={isActive} />}
        actions={
          <Button
            variant={isActive ? 'outline' : 'default'}
            onClick={() => {
              setConfirming(true);
            }}
          >
            {isActive ? <PowerOff aria-hidden="true" /> : <Power aria-hidden="true" />}
            {isActive ? 'Desactivar institución' : 'Reactivar institución'}
          </Button>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[3fr_2fr]">
        <Section title="Datos generales">
          <InstitutionForm
            formId="institution-edit"
            institution={institution}
            error={update.error}
            onSubmit={(_body, changed) => {
              if (Object.keys(changed).length === 0) {
                toast.info('No hay cambios para guardar.');
                return;
              }
              update.mutate(changed, { onSuccess: () => toast.success('Cambios guardados.') });
            }}
          />
          <Button
            type="submit"
            form="institution-edit"
            className="self-start"
            disabled={update.isPending}
          >
            {update.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </Section>
        <Section title="Logo" description="Aparece en el encabezado de los boletines.">
          <LogoEditor institution={institution} mutations={logo} canEdit />
        </Section>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={isActive ? `¿Desactivar ${name}?` : `¿Reactivar ${name}?`}
        description={
          isActive
            ? 'Nadie podrá entrar a esta institución mientras esté inactiva. Sus datos se conservan y puedes reactivarla cuando quieras.'
            : 'Sus usuarios vuelven a entrar con los roles que tenían.'
        }
        confirmLabel={isActive ? 'Desactivar institución' : 'Reactivar institución'}
        pendingLabel={isActive ? 'Desactivando…' : 'Reactivando…'}
        destructive={isActive}
        pending={setActive.isPending}
        onConfirm={() => {
          setActive.mutate(!isActive, {
            onSuccess: () => {
              toast.success(isActive ? `${name} quedó inactiva.` : `${name} quedó activa.`);
              setConfirming(false);
            },
            onError: (err) => toast.error(errorMessage(err)),
          });
        }}
      />
    </>
  );
}
