import { zodResolver } from '@hookform/resolvers/zod';
import { CornerDownRight, Pencil, Plus, Power, PowerOff } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import type { MenuOptionNode } from '@/api/types';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { RowActions } from '@/components/data/data-list';
import { Field } from '@/components/form/field';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input, NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/features/layout/page-header';
import { MenuIcon } from '@/features/menu/menu-icon';
import { MENU_ICON_NAMES } from '@/features/menu/menu-icons';
import { cn } from '@/lib/utils';
import {
  MAX_MENU_DEPTH,
  parentChoices,
  useCreateMenuOption,
  useSetMenuOptionActive,
  useUpdateMenuOption,
} from './menu-options-api';
import { useMenuTree } from './roles-api';

type Open =
  | { kind: 'create'; parentId: string | null }
  | { kind: 'edit'; option: MenuOptionNode }
  | { kind: 'toggle'; option: MenuOptionNode }
  | null;

/**
 * Árbol de opciones del menú. /security/menu-options: de solo lectura (las
 * opciones son de todo Aula360). /admin/menu-options: el SUPER_ADMIN crea,
 * edita, mueve, ordena, activa y desactiva.
 */
export function MenuOptionsPage({ editable }: { editable: boolean }) {
  const { data: tree, isPending, isError, refetch } = useMenuTree();
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
  };
  const setActive = useSetMenuOptionActive();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={editable ? 'Opciones de menú' : 'Menús'}
        description={
          editable
            ? 'El menú de todas las instituciones. El slug de cada opción es su clave de permiso y no cambia.'
            : 'Las opciones del menú de Aula360. Qué ve cada persona depende de los permisos de sus roles.'
        }
        actions={
          editable && (
            <Button
              onClick={() => {
                setOpen({ kind: 'create', parentId: null });
              }}
            >
              <Plus aria-hidden="true" />
              Nueva opción
            </Button>
          )
        }
      />
      {isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="error">
          No pudimos cargar el menú.{' '}
          <button
            type="button"
            className="cursor-pointer font-bold text-primary underline"
            onClick={() => void refetch()}
          >
            Reintentar
          </button>
        </Alert>
      ) : (
        <ul
          aria-label="Opciones del menú"
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          {tree.map((node) => (
            <TreeItem key={node.id} node={node} depth={1} editable={editable} onOpen={setOpen} />
          ))}
        </ul>
      )}

      <Dialog
        open={open?.kind === 'create' || open?.kind === 'edit'}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        {tree && (open?.kind === 'create' || open?.kind === 'edit') && (
          <MenuOptionFormDialog
            key={open.kind === 'edit' ? open.option.id : `new-${String(open.parentId)}`}
            tree={tree}
            option={open.kind === 'edit' ? open.option : undefined}
            parentId={open.kind === 'create' ? open.parentId : open.option.parentId}
            onDone={close}
          />
        )}
      </Dialog>

      {open?.kind === 'toggle' && (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          title={
            open.option.isActive
              ? `¿Desactivar «${open.option.name}»?`
              : `¿Reactivar «${open.option.name}»?`
          }
          description={
            open.option.isActive
              ? 'Desaparece del menú de todas las instituciones junto con las opciones que tiene dentro, y sus permisos dejan de valer mientras esté inactiva. Los roles conservan esos permisos para cuando la reactives.'
              : 'Vuelve a aparecer en el menú de quienes tengan permiso, con las opciones activas que tiene dentro.'
          }
          confirmLabel={open.option.isActive ? 'Desactivar opción' : 'Reactivar opción'}
          pendingLabel={open.option.isActive ? 'Desactivando…' : 'Reactivando…'}
          destructive={open.option.isActive}
          pending={setActive.isPending}
          onConfirm={() => {
            const { option } = open;
            setActive.mutate(
              { id: option.id, active: !option.isActive },
              {
                onSuccess: () => {
                  toast.success(
                    option.isActive
                      ? `«${option.name}» desactivada.`
                      : `«${option.name}» reactivada.`,
                  );
                  close();
                },
                onError: (err) => toast.error(errorMessage(err)),
              },
            );
          }}
        />
      )}
    </div>
  );
}

function TreeItem({
  node,
  depth,
  editable,
  onOpen,
}: {
  node: MenuOptionNode;
  depth: number;
  editable: boolean;
  onOpen: (open: Open) => void;
}) {
  return (
    <li className="border-b border-border last:border-b-0 [&_li:last-child]:border-b-0">
      <div
        className="flex items-center gap-3 py-2.5 pr-2"
        style={{ paddingLeft: `${String(12 + (depth - 1) * 24)}px` }}
      >
        {depth > 1 && (
          <CornerDownRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <MenuIcon name={node.icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className={cn('break-words', depth === 1 && 'font-bold')}>{node.name}</div>
          <div className="text-sm break-all text-muted-foreground">
            {node.slug} · orden {node.displayOrder}
          </div>
        </div>
        {!node.isActive && <StatusBadge active={false} />}
        {editable && (
          <RowActions label={`Acciones de ${node.name}`}>
            <DropdownMenuItem
              onSelect={() => {
                onOpen({ kind: 'edit', option: node });
              }}
            >
              <Pencil aria-hidden="true" />
              Editar o mover
            </DropdownMenuItem>
            {depth < MAX_MENU_DEPTH && (
              <DropdownMenuItem
                onSelect={() => {
                  onOpen({ kind: 'create', parentId: node.id });
                }}
              >
                <Plus aria-hidden="true" />
                Agregar opción dentro
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant={node.isActive ? 'destructive' : undefined}
              onSelect={() => {
                onOpen({ kind: 'toggle', option: node });
              }}
            >
              {node.isActive ? <PowerOff aria-hidden="true" /> : <Power aria-hidden="true" />}
              {node.isActive ? 'Desactivar' : 'Reactivar'}
            </DropdownMenuItem>
          </RowActions>
        )}
      </div>
      {node.children.length > 0 && (
        <ul aria-label={`Dentro de ${node.name}`}>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              editable={editable}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// Las mismas reglas que CreateMenuOptionDto.
const schema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre.').max(100, 'Máximo 100 caracteres.'),
  slug: z
    .string()
    .trim()
    .max(255, 'Máximo 255 caracteres.')
    .regex(
      /^[a-z0-9-]+(\.[a-z0-9-]+)*$/,
      'Minúsculas, números o guiones, separados por puntos (como academic.courses).',
    ),
  parentId: z.string(),
  icon: z.string(),
  displayOrder: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, 'Un número entero de 0 a 10000.')
    .transform(Number)
    .pipe(z.number().max(10000, 'Un número entero de 0 a 10000.')),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const FORM_ID = 'menu-option-form';

function MenuOptionFormDialog({
  tree,
  option,
  parentId,
  onDone,
}: {
  tree: MenuOptionNode[];
  option?: MenuOptionNode;
  parentId: string | null;
  onDone: () => void;
}) {
  const create = useCreateMenuOption();
  const update = useUpdateMenuOption();
  const mutation = option ? update : create;
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: option?.name ?? '',
      slug: option?.slug ?? '',
      parentId: parentId ?? '',
      icon: option?.icon ?? '',
      displayOrder: String(option?.displayOrder ?? 0),
    },
  });
  const { errors } = form.formState;
  const icon = useWatch({ control: form.control, name: 'icon' });
  const choices = parentChoices(tree, option);

  const onSubmit = form.handleSubmit((values) => {
    const body = {
      name: values.name,
      parentId: values.parentId || null,
      icon: values.icon || null,
      displayOrder: values.displayOrder,
    };
    const options = {
      onSuccess: () => {
        toast.success(option ? 'Opción guardada.' : `Opción «${values.name}» creada.`);
        onDone();
      },
    };
    if (option) update.mutate({ id: option.id, body }, options);
    else create.mutate({ ...body, slug: values.slug }, options);
  });

  return (
    <DialogContent
      title={option ? 'Editar opción' : 'Nueva opción'}
      description={
        option ? undefined : 'Aparece en el menú de quienes tengan un rol con permiso sobre ella.'
      }
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" form={FORM_ID} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : option ? 'Guardar cambios' : 'Crear opción'}
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
        {mutation.isError && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
        <Field label="Nombre" error={errors.name?.message}>
          {(control) => <Input autoComplete="off" {...control} {...form.register('name')} />}
        </Field>
        <Field
          label="Slug"
          error={errors.slug?.message}
          hint={
            option
              ? 'Es la clave de permiso: no se puede cambiar.'
              : 'Clave de permiso que usa el backend, como academic.courses. Después no se puede cambiar.'
          }
        >
          {(control) => (
            <Input
              autoComplete="off"
              spellCheck={false}
              readOnly={option !== undefined}
              className={cn(option && 'bg-muted text-muted-foreground')}
              {...control}
              {...form.register('slug')}
            />
          )}
        </Field>
        <Field label="Dentro de" error={errors.parentId?.message}>
          {(control) => (
            <NativeSelect {...control} {...form.register('parentId')}>
              <option value="">Ninguna (primer nivel)</option>
              {choices.map(({ node, depth }) => (
                <option key={node.id} value={node.id}>
                  {'— '.repeat(depth - 1)}
                  {node.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
          <Field label="Ícono" error={errors.icon?.message}>
            {(control) => (
              <div className="flex items-center gap-3">
                <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <MenuIcon name={icon || null} className="size-6" />
                </span>
                <NativeSelect {...control} {...form.register('icon')}>
                  <option value="">Sin ícono</option>
                  {MENU_ICON_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}
          </Field>
          <Field label="Orden" error={errors.displayOrder?.message}>
            {(control) => (
              <Input inputMode="numeric" {...control} {...form.register('displayOrder')} />
            )}
          </Field>
        </div>
      </form>
    </DialogContent>
  );
}
