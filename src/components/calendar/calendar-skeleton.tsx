import { cn } from '@/lib/utils';

const CELLS = Array.from({ length: 35 });

export function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 border-b" data-testid="calendar-skeleton" aria-hidden="true">
      {CELLS.map((_, i) => (
        <div
          key={i}
          className={cn('bg-muted/40 min-h-[80px] animate-pulse border-r border-b last:border-r-0')}
        />
      ))}
    </div>
  );
}
