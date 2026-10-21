import { cn } from '@/lib/utils';
import { THEME_OPTIONS } from './theme-options';
import { useTheme } from './theme-context';

/** Control segmentado Claro / Oscuro / Sistema. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn('inline-flex gap-0.5 rounded-full border border-rule bg-card p-1', className)}
    >
      {THEME_OPTIONS.map(({ value, label, Icon }) => {
        const checked = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={label}
            title={label}
            onClick={() => {
              setPreference(value);
            }}
            className={cn(
              'inline-flex h-9 w-10 cursor-pointer items-center justify-center rounded-full transition-colors',
              checked
                ? 'bg-foreground text-background dark:bg-accent dark:text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
