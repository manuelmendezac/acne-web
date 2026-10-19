import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * The heading of a portal screen: one `h1`, an optional line under it, and the actions that belong
 * to the whole page on the right.
 *
 * Screens used to open with their own ad-hoc `h1` while the top bar repeated the section name, so
 * every page said where it was twice. The top bar now shows the breadcrumb and this is the only
 * title.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** A short label above the title: the patient's code, the section a form belongs to. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow !== undefined ? (
          <p className="mb-1 text-xs font-medium text-neutral-500">{eyebrow}</p>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{title}</h1>
        {description !== undefined ? (
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">{description}</p>
        ) : null}
      </div>
      {actions !== undefined ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
