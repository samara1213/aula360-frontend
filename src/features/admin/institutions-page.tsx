import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { Institution } from '@/api/types';
import { DataList, Pagination, type Column } from '@/components/data/data-list';
import { useListParams } from '@/components/data/list-params';
import { ListToolbar, SearchInput, StatusSelect } from '@/components/data/list-toolbar';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { useCreateInstitution, useInstitutions } from '@/features/institution/institution-api';
import { InstitutionLogo } from '@/features/institution/institution-logo';
import { PageHeader } from '@/features/layout/page-header';
import { formatScore } from '@/lib/format';
import { InstitutionForm } from './institution-form';

const COLUMNS: Column<Institution>[] = [
  {
    key: 'name',
    header: 'Institución',
    cell: (i) => (
      <Link
        to={`/admin/institutions/${encodeURIComponent(i.id)}`}
        className="inline-flex items-center gap-3 rounded-md text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-ring/25"
      >
        <InstitutionLogo url={i.logoUrl} className="size-10" />
        <span className="min-w-0">{i.name}</span>
      </Link>
    ),
  },
  { key: 'nit', header: 'NIT', cell: (i) => i.nit },
  {
    key: 'scale',
    header: 'Escala',
    cell: (i) =>
      `${formatScore(i.gradingScaleMin)} a ${formatScore(i.gradingScaleMax)} (aprueba con ${formatScore(i.passingScore)})`,
  },
  { key: 'status', header: 'Estado', cell: (i) => <StatusBadge active={i.isActive} /> },
];

/** /admin/institutions: todas las instituciones (SUPER_ADMIN). */
export function InstitutionsPage() {
  const list = useListParams();
  const { data, isPending, isFetching, error, refetch } = useInstitutions(list.query);
  const [creating, setCreating] = useState(false);
  const filtered = list.search !== '' || list.status !== 'active';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Instituciones"
        description="Los colegios que usan Aula360. Entra a una para editar sus datos y su logo."
        actions={
          <Button
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus aria-hidden="true" />
            Nueva institución
          </Button>
        }
      />
      <ListToolbar>
        <SearchInput
          label="Buscar"
          placeholder="Nombre o NIT"
          value={list.search}
          onChange={(search) => {
            list.update({ search });
          }}
        />
        <StatusSelect
          value={list.status}
          onChange={(status) => {
            list.update({ status });
          }}
        />
      </ListToolbar>
      <DataList
        label="Instituciones"
        columns={COLUMNS}
        rows={data?.data}
        getKey={(i) => i.id}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={
          filtered ? (
            <p>Ninguna institución coincide con la búsqueda.</p>
          ) : (
            <p className="font-bold">Todavía no hay instituciones. Crea la primera.</p>
          )
        }
      />
      <Pagination
        meta={data?.meta}
        noun="instituciones"
        onPage={(page) => {
          list.update({ page });
        }}
      />
      <Dialog open={creating} onOpenChange={setCreating}>
        {creating && (
          <CreateInstitutionDialog
            onDone={() => {
              setCreating(false);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function CreateInstitutionDialog({ onDone }: { onDone: () => void }) {
  const create = useCreateInstitution();
  const navigate = useNavigate();
  return (
    <DialogContent
      title="Nueva institución"
      description="Después podrás subir su logo y crear su primer administrador."
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form="institution-create" disabled={create.isPending}>
            {create.isPending ? 'Creando…' : 'Crear institución'}
          </Button>
        </>
      }
    >
      <InstitutionForm
        formId="institution-create"
        error={create.error}
        onSubmit={(body) => {
          create.mutate(body, {
            onSuccess: (institution) => {
              toast.success(`Institución «${institution.name}» creada.`);
              onDone();
              void navigate(`/admin/institutions/${encodeURIComponent(institution.id)}`);
            },
          });
        }}
      />
    </DialogContent>
  );
}
