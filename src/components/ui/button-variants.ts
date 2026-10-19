import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Button class variants.
 *
 * Deliberately in its own module WITHOUT `'use client'`: server components style `<Link>` as a
 * button by calling `buttonVariants(...)` during render. Exporting it from the client component
 * file would hand the server a client-reference proxy instead of the function, and the page would
 * crash at prerender with "(0 , l.d) is not a function".
 *
 * Section 12.3 requires repeated visual patterns to live in React components with Tailwind
 * utilities, never in CSS classes; `class-variance-authority` is what keeps the variants in
 * TypeScript.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-900 ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-purple-900 text-white hover:bg-purple-800',
        secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
        outline: 'border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100',
        ghost: 'text-neutral-900 hover:bg-neutral-100',
        danger: 'bg-red-700 text-white hover:bg-red-800',
        success: 'bg-emerald-700 text-white hover:bg-emerald-800',
        link: 'text-purple-900 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
