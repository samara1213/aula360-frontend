import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from '@/lib/zod';
import { errorMessage } from '@/api/errors';
import type { CatalogItem } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataList, Pagination, RowActions, type Column } from '@/components/data/data-list';
import { useListParams } from '@/components/data/list-params';
import { ListToolbar, SearchInput } from '@/components/data/list-toolbar';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/features/layout/page-header';
import { usePermissions } from '@/features/menu/menu';
import {
  useCatalog,
  useDeleteCatalogItem,
  useSaveCatalogItem,
  type CatalogKind,
} from './academic-api';

/** Textos de cada catálogo (el género cambia los artículos). */
const CATALOGS = {
  grades: {
    slug: 'academic.grades',
    title: 'Grados',
    description:
      'Los niveles de la institución (Sexto, Séptimo...). Cada curso pertenece a un grado.',
    noun: 'grados',
    one: 'grado',
    newLabel: 'Nuevo grado',
    placeholder: 'Sexto',
    required: 'Escribe el nombre del grado.',
    maxLength: 100,
    created: (name: string) => `«${name}» creado.`,
    saved: 'Grado guardado.',
    deleted: (name: string) => `«${name}» se eliminó.`,
    deleteHint: 'Solo se puede eliminar un grado sin cursos.',
    emptyHint: 'Crea el primero con «Nuevo grado».',
    noMatch: 'Ningún grado coincide con la búsqueda.',
    none: 'Todavía no hay grados.',
  },
  subjects: {
    slug: 'academic.subjects',
    title: 'Materias',
    description:
      'Las asignaturas que se dictan en la institución. Se asignan a los cursos en la carga académica.',
    noun: 'materias',
    one: 'materia',
    newLabel: 'Nueva materia',
    placeholder: 'Matemáticas',
    required: 'Escribe el nombre de la materia.',
    maxLength: 150,
    created: (name: string) => `«${name}» creada.`,
    saved: 'Materia guardada.',
    deleted: (name: string) => `«${name}» se eliminó.`,
    deleteHint: 'Solo se puede eliminar una materia sin carga académica.',
    emptyHint: 'Crea la primera con «Nueva materia».',
    noMatch: 'Ninguna materia coincide con la búsqueda.',
    none: 'Todavía no hay materias.',
  },
} as const;

type Open = { kind: 'create' } | { kind: 'edit' | 'delete'; item: CatalogItem } | null;

const COLUMNS: Column<CatalogItem>[] = [{ key: 'name', header: 'Nombre', cell: (i) => i.name }];

/** /academic/grades y /academic/subjects */
export function CatalogPage({ kind }: { kind: CatalogKind }) {
  const text = CATALOGS[kind];
  const list = useListParams();
  // Grados y materias no tienen estado: solo página y búsqueda (SearchQueryDto).
  const { page, limit, search } = list.query;
  const { data, isPending, isFetching, error, refetch } = useCatalog(kind, {
    page,
    limit,
    ...(search ? { search } : {}),
  });
  // Las escrituras exigen el permiso en toda la institución.
  const can = usePermissions(text.slug).institutionWide;
  const remove = useDeleteCatalogItem(kind);
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={text.title}
        description={text.description}
        actions={
          can.create && (
            <Button
              onClick={() => {
                setOpen({ kind: 'create' });
              }}
            >
              <Plus aria-hidden="true" />
              {text.newLabel}
            </Button>
          )
        }
      />
      <ListToolbar>
        <SearchInput
          label="Buscar"
          placeholder="Nombre"
          value={list.search}
          onChange={(value) => {
            list.update({ search: value });
          }}
        />
      </ListToolbar>
      <DataList
        label={text.title}
        columns={COLUMNS}
        rows={data?.data}
        getKey={(i) => i.id}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={
          list.search !== '' ? (
            <p>{text.noMatch}</p>
          ) : (
            <>
              <p className="font-bold">{text.none}</p>
              {can.create && <p className="mt-1 text-muted-foreground">{text.emptyHint}</p>}
            </>
          )
        }
        actions={
          can.update || can.delete
            ? (item) => (
                <RowActions label={`Acciones de ${item.name}`}>
                  {can.update && (
                    <DropdownMenuItem
                      onSelect={() => {
                        setOpen({ kind: 'edit', item });
                      }}
                    >
                      <Pencil aria-hidden="true" />
                      Cambiar el nombre
                    </DropdownMenuItem>
                  )}
                  {can.delete && (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        setOpen({ kind: 'delete', item });
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      Eliminar
                    </DropdownMenuItem>
                  )}
                </RowActions>
              )
            : undefined
        }
      />
      <Pagination
        meta={data?.meta}
        noun={text.noun}
        onPage={(next) => {
          list.update({ page: next });
        }}
      />

      <Dialog
        open={open?.kind === 'create' || open?.kind === 'edit'}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        {(open?.kind === 'create' || open?.kind === 'edit') && (
          <CatalogFormDialog
            key={open.kind === 'edit' ? open.item.id : 'new'}
            kind={kind}
            item={open.kind === 'edit' ? open.item : undefined}
            onDone={close}
          />
        )}
      </Dialog>

      {open?.kind === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          title={`¿Eliminar «${open.item.name}»?`}
          description={`${text.deleteHint} Esta acción no se puede deshacer.`}
          confirmLabel={`Eliminar ${text.one}`}
          pendingLabel="Eliminando…"
          destructive
          pending={remove.isPending}
          onConfirm={() => {
            const { item } = open;
            remove.mutate(item.id, {
              onSuccess: () => {
                toast.success(text.deleted(item.name));
                close();
              },
              onError: (err) => toast.error(errorMessage(err)),
            });
          }}
        />
      )}
    </div>
  );
}

const FORM_ID = 'catalog-form';

function CatalogFormDialog({
  kind,
  item,
  onDone,
}: {
  kind: CatalogKind;
  item?: CatalogItem;
  onDone: () => void;
}) {
  const text = CATALOGS[kind];
  const save = useSaveCatalogItem(kind);
  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1, text.required)
      .max(text.maxLength, `Máximo ${String(text.maxLength)} caracteres.`),
  });
  const form = useForm<{ name: string }>({
    resolver: zodResolver(schema),
    defaultValues: { name: item?.name ?? '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(({ name }) => {
    if (item && name === item.name) {
      onDone();
      return;
    }
    save.mutate(
      { id: item?.id, name },
      {
        onSuccess: () => {
          toast.success(item ? text.saved : text.created(name));
          onDone();
        },
      },
    );
  });

  return (
    <DialogContent
      title={item ? 'Cambiar el nombre' : text.newLabel}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : item ? 'Guardar cambios' : `Crear ${text.one}`}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(e) => void onSubmit(e)}
        className="flex flex-col gap-5"
      >
        {save.isError && <Alert variant="error">{errorMessage(save.error)}</Alert>}
        <Field label="Nombre" error={errors.name?.message}>
          {(control) => (
            <Input
              autoComplete="off"
              placeholder={text.placeholder}
              {...control}
              {...form.register('name')}
            />
          )}
        </Field>
      </form>
    </DialogContent>
  );
}
