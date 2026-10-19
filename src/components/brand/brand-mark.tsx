import { cn } from '@/lib/cn';
import { PRODUCT_NAME } from '@/lib/constants';

/**
 * The Dermatrix mark.
 *
 * A purple tile with a 3 × 3 grid of dots whose main diagonal is lit: the grid is the matrix of
 * views and readings the system works from, the dots are the texture of skin, and the lit diagonal
 * is what has been examined. Same drawing as `public/icons/icon-*.svg` and `src/app/icon.svg`;
 * kept as a component so it stays crisp at any size and takes its colours from Tailwind classes.
 */
export function BrandMark({
  className,
  title = PRODUCT_NAME,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 192 192"
      className={cn('h-10 w-10', className)}
      role="img"
      aria-label={title}
    >
      <rect width="192" height="192" rx="40" className="fill-purple-900" />
      {GRID.map(([cx, cy, lit]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={lit ? 13 : 10}
          className={lit ? 'fill-white' : 'fill-purple-300'}
          opacity={lit ? 1 : 0.55}
        />
      ))}
    </svg>
  );
}

/** Centre and whether the dot sits on the lit diagonal. */
const GRID: ReadonlyArray<readonly [number, number, boolean]> = [
  [60, 60, true],
  [96, 60, false],
  [132, 60, false],
  [60, 96, false],
  [96, 96, true],
  [132, 96, false],
  [60, 132, false],
  [96, 132, false],
  [132, 132, true],
];
