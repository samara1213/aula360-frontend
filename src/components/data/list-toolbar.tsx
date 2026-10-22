import { Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { inputClasses, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { SEARCH_MAX, type StatusFilter } from './list-params';

const DEBOUNCE_MS = 300;

/** Fila de filtros encima de un listado. */
export function ListToolbar({ children }: { children: ReactNode }) {
  return (
    <div role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {children}
    </div>
  );
}

/**
 * Búsqueda que espera a que se deje de escribir. Si la URL cambia por fuera
 * (atrás, un enlace), el texto la sigue.
 */
export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  const timer = useRef<number | undefined>(undefined);

  // Ajuste durante el render (no en un efecto): la URL cambió por fuera.
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  const commit = (next: string, wait: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      onChange(next);
    }, wait);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id={id}
          type="search"
          value={draft}
          maxLength={SEARCH_MAX}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className={cn(inputClasses, 'pr-11 pl-11 [&::-webkit-search-cancel-button]:hidden')}
          onChange={(e) => {
            setDraft(e.target.value);
            commit(e.target.value, DEBOUNCE_MS);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(draft, 0);
          }}
        />
        {draft && (
          <button
            type="button"
            aria-label="Borrar la búsqueda"
            className="absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-accent focus-visible:ring-4 focus-visible:ring-ring/25"
            onClick={() => {
              setDraft('');
              commit('', 0);
            }}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export function StatusSelect({
  value,
  onChange,
  labels = ['Activas', 'Inactivas', 'Todas'],
}: {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
  /** Para sustantivos masculinos: ['Activos', 'Inactivos', 'Todos']. */
  labels?: readonly [string, string, string];
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2 sm:w-44">
      <Label htmlFor={id}>Estado</Label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value as StatusFilter);
        }}
      >
        <option value="active">{labels[0]}</option>
        <option value="inactive">{labels[1]}</option>
        <option value="all">{labels[2]}</option>
      </NativeSelect>
    </div>
  );
}

/** Filtro de un listado con una lista de opciones; '' es «todos». */
export function SelectFilter({
  label,
  value,
  options,
  onChange,
  allLabel = 'Todos',
  className = 'sm:w-52',
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  /** null: sin opción «todos» (siempre hay uno elegido). */
  allLabel?: string | null;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        {allLabel !== null && <option value="">{allLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
