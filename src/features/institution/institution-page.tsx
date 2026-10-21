import { ChevronRight, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Institution } from '@/api/types';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import { formatScore } from '@/lib/format';
import { useCurrentInstitution, useCurrentLogo } from './institution-api';
import { LogoEditor } from './institution-logo';

/** /institution: datos de la institución activa y su logo. */
export function InstitutionPage() {
  const { data: institution, isPending, isError, refetch } = useCurrentInstitution();
  const permissions = usePermissions('institution');
  const campuses = usePermissions('institution.campuses');
  const logo = useCurrentLogo();

  if (isPending) {
    return (
      <div className="flex flex-col gap-8" aria-busy="true">
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <div className="grid gap-6 xl:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    );
  }
  if (isError) {
    return (
      <Alert variant="error">
        No pudimos cargar los datos de la institución.{' '}
        <button
          type="button"
          className="cursor-pointer font-bold text-primary underline"
          onClick={() => void refetch()}
        >
          Reintentar
        </button>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={institution.name}
        description="Datos de la institución y el logo que aparece en los boletines."
        actions={
          campuses.view && (
            <Button variant="outline" asChild>
              <Link to="/institution/campuses">
                <MapPin aria-hidden="true" />
                Ver sedes
                <ChevronRight className="size-4!" aria-hidden="true" />
              </Link>
            </Button>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Datos generales">
          <InstitutionFacts institution={institution} />
          <p className="text-sm text-muted-foreground">
            El nombre, el NIT y la escala de notas los cambia la administración general de Aula360.
          </p>
        </Section>
        <Section title="Logo">
          <LogoEditor
            institution={institution}
            mutations={logo}
            canEdit={permissions.institutionWide.update}
          />
        </Section>
      </div>
    </div>
  );
}

/** Nombre, NIT, escala de notas y estado. */
export function InstitutionFacts({ institution }: { institution: Institution }) {
  const facts: [string, ReactNode][] = [
    ['Nombre', institution.name],
    ['NIT', institution.nit],
    [
      'Escala de notas',
      `De ${formatScore(institution.gradingScaleMin)} a ${formatScore(institution.gradingScaleMax)}`,
    ],
    ['Nota mínima para aprobar', formatScore(institution.passingScore)],
    ['Estado', <StatusBadge key="estado" active={institution.isActive} />],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
      {facts.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="-mt-2 font-bold break-words sm:mt-0">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
