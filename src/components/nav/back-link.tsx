import { ChevronLeftIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface Props {
  href: string;
  label: string;
  className?: string;
  // Required at every callsite — the local ESLint rule treats this component
  // as interactive (it carries `href`) and demands `data-testid`. Declaring
  // the prop with the literal dashed name lets the rule see it.
  'data-testid': string;
}

/**
 * Small chevron-prefixed link rendered above a page title to let the user
 * jump one level up the navigation tree. Server-component-safe — wraps the
 * locale-aware `<Link>` and never touches client state.
 */
export function BackLink({ href, label, className, 'data-testid': testId }: Props) {
  return (
    <Link
      href={href}
      className={cn(
        'text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm',
        className,
      )}
      data-testid={testId}
    >
      <ChevronLeftIcon className="h-4 w-4" />
      {label}
    </Link>
  );
}
