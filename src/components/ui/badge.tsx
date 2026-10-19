import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const badgeVariants = cva(
  // `whitespace-nowrap`: a badge is a label, not a paragraph.
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-neutral-100 text-neutral-700',
        primary: 'bg-purple-50 text-purple-900',
        success: 'bg-emerald-50 text-emerald-700',
        warning: 'bg-amber-50 text-amber-700',
        danger: 'bg-red-50 text-red-700',
        outline: 'border border-neutral-200 text-neutral-500',
        // Experimental condition: colour-coded identically everywhere so the physician can never
        // mistake which condition a screen belongs to.
        pretest: 'bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-300',
        postest: 'bg-purple-50 text-purple-900 ring-1 ring-inset ring-purple-900/20',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Badge for a study mode, so the mapping mode → colour exists in exactly one place. */
export function StudyModeBadge({ mode, className }: { mode: string; className?: string }) {
  const labels: Record<string, string> = {
    pretest: 'Fase pretest',
    postest: 'Fase postest',
    produccion: 'Producción',
  };
  const variant = mode === 'pretest' ? 'pretest' : mode === 'postest' ? 'postest' : 'outline';
  return (
    <Badge variant={variant} className={className}>
      {labels[mode] ?? mode}
    </Badge>
  );
}
