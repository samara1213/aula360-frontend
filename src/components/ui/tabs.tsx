import { Tabs as Primitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Tabs = Primitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      className={cn(
        'flex max-w-full [scrollbar-width:none] gap-1 overflow-x-auto border-b border-rule',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cn(
        '-mb-px inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 border-b-[3px] border-transparent px-3 font-bold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/25 data-[state=active]:border-primary data-[state=active]:text-foreground sm:px-4 [&_svg]:hidden [&_svg]:size-5 sm:[&_svg]:block',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Content className={cn('pt-6 outline-none', className)} {...props} />;
}
