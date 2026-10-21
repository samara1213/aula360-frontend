import { cn } from '@/lib/utils';

/** Logo: el aro de «360» en lapicero con el punto rojo del margen. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-[0_6px_18px_rgb(5_10_40/0.25)]',
        className,
      )}
    >
      <svg viewBox="0 0 28 28" fill="none" className="size-[64%]">
        <path
          d="M23 14a9 9 0 1 1-3.2-6.9"
          stroke="#2343C4"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M20.6 3.6l-.6 4.6-4.5-.9"
          stroke="#2343C4"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="14" cy="14" r="3" fill="#D33F5A" />
      </svg>
    </span>
  );
}

export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cn('text-[26px] font-extrabold tracking-tight', className)}>Aula360</span>
  );
}
