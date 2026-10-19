import { BrandMark } from '@/components/brand/brand-mark';
import { cn } from '@/lib/cn';
import { PRODUCT_NAME } from '@/lib/constants';

const SIZES = {
  sm: { mark: 'h-7 w-7', name: 'text-sm', subtitle: 'text-xs' },
  md: { mark: 'h-9 w-9', name: 'text-base', subtitle: 'text-xs' },
  lg: { mark: 'h-12 w-12', name: 'text-2xl', subtitle: 'text-sm' },
} as const;

/**
 * Mark + name, the one way the product signs its screens.
 *
 * `tone` follows the surface: `dark` for the sidebar and the sign-in panel, `light` for white
 * chrome. The optional subtitle is for *which* part of the product this is (the portal's name, the
 * capture page), never a tagline.
 */
export function Wordmark({
  size = 'md',
  tone = 'light',
  subtitle,
  className,
}: {
  size?: keyof typeof SIZES;
  tone?: 'light' | 'dark';
  subtitle?: string;
  className?: string;
}) {
  const sizes = SIZES[size];
  const onDark = tone === 'dark';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark className={cn('shrink-0', sizes.mark)} />
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            'block truncate font-semibold tracking-tight',
            sizes.name,
            onDark ? 'text-white' : 'text-neutral-900',
          )}
        >
          {PRODUCT_NAME}
        </span>
        {subtitle !== undefined ? (
          <span
            className={cn(
              'block truncate',
              sizes.subtitle,
              onDark ? 'text-neutral-400' : 'text-neutral-500',
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
