'use client';

import { useMemo } from 'react';

import { cn } from '@/lib/cn';
import { num } from '@/lib/format';

/**
 * Box-and-whisker plot, drawn as inline SVG.
 *
 * Covers: RF-OE4-04 ("panel comparativo con boxplots por profesional y por modo") and the
 * comparative plots of the indicators dashboard.
 *
 * Written by hand rather than pulled from a library because Recharts has no native boxplot, and
 * because a boxplot is the one chart in this study that must be read precisely: the reader is
 * comparing the spread of review times between two conditions, so whiskers, outliers and the
 * median line all have to be exactly where the numbers say they are.
 *
 * Uses the Tukey convention: whiskers reach the furthest observation within 1,5 × IQR of the
 * quartiles, and anything beyond is drawn as an individual outlier point.
 */

export interface BoxPlotSeries {
  label: string;
  values: number[];
  /** Tailwind text colour class; the marks inherit it through `currentColor`. */
  colorClass?: string;
}

interface BoxStats {
  n: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  lowerWhisker: number;
  upperWhisker: number;
  outliers: number[];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const first = sorted[0] ?? 0;
  if (sorted.length === 1) return first;

  const index = (sorted.length - 1) * p;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sorted[lowerIndex] ?? first;
  const upper = sorted[upperIndex] ?? first;
  return lowerIndex === upperIndex ? lower : lower + (upper - lower) * (index - lowerIndex);
}

function computeStats(values: number[]): BoxStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);

  const q1 = percentile(sorted, 0.25);
  const median = percentile(sorted, 0.5);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const inside = sorted.filter((v) => v >= lowerFence && v <= upperFence);
  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);

  return {
    n: sorted.length,
    min: sorted[0] ?? 0,
    q1,
    median,
    q3,
    max: sorted[sorted.length - 1] ?? 0,
    lowerWhisker: inside[0] ?? (sorted[0] ?? 0),
    upperWhisker: inside[inside.length - 1] ?? (sorted[sorted.length - 1] ?? 0),
    outliers,
  };
}

export function BoxPlot({
  series,
  unit = '',
  height = 260,
  className,
}: {
  series: BoxPlotSeries[];
  unit?: string;
  height?: number;
  className?: string;
}) {
  const prepared = useMemo(
    () => series.map((s) => ({ ...s, stats: computeStats(s.values) })),
    [series],
  );

  const allValues = prepared.flatMap((s) => s.values);
  if (allValues.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-neutral-500">
        Todavía no hay mediciones suficientes para dibujar el diagrama de caja.
      </p>
    );
  }

  // 8 % padding keeps whisker caps and outlier dots from touching the frame.
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const span = rawMax - rawMin || Math.abs(rawMax) || 1;
  const domainMin = rawMin - span * 0.08;
  const domainMax = rawMax + span * 0.08;

  const width = 640;
  const padding = { top: 16, right: 16, bottom: 44, left: 56 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const toY = (value: number): number =>
    padding.top + plotHeight - ((value - domainMin) / (domainMax - domainMin)) * plotHeight;

  const slot = plotWidth / prepared.length;
  const boxWidth = Math.min(72, slot * 0.46);

  const ticks = Array.from({ length: 5 }, (_, i) => domainMin + ((domainMax - domainMin) * i) / 4);

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[520px]"
        role="img"
        aria-label={`Diagrama de caja de ${prepared.map((s) => s.label).join(' y ')}`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={toY(tick)}
              y2={toY(tick)}
              className="stroke-neutral-200"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={padding.left - 8}
              y={toY(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-neutral-500 text-xs tabular-nums"
            >
              {num(tick, 1)}
            </text>
          </g>
        ))}

        {prepared.map((entry, index) => {
          const stats = entry.stats;
          const centre = padding.left + slot * index + slot / 2;
          if (stats === null) {
            return (
              <text
                key={entry.label}
                x={centre}
                y={padding.top + plotHeight / 2}
                textAnchor="middle"
                className="fill-neutral-500 text-xs"
              >
                sin datos
              </text>
            );
          }

          const colour = entry.colorClass ?? 'text-purple-900';
          const boxTop = toY(stats.q3);
          const boxBottom = toY(stats.q1);

          return (
            <g key={entry.label} className={colour}>
              {/* Whiskers */}
              <line
                x1={centre}
                x2={centre}
                y1={toY(stats.upperWhisker)}
                y2={boxTop}
                stroke="currentColor"
                strokeWidth={1.5}
              />
              <line
                x1={centre}
                x2={centre}
                y1={boxBottom}
                y2={toY(stats.lowerWhisker)}
                stroke="currentColor"
                strokeWidth={1.5}
              />
              <line
                x1={centre - boxWidth / 4}
                x2={centre + boxWidth / 4}
                y1={toY(stats.upperWhisker)}
                y2={toY(stats.upperWhisker)}
                stroke="currentColor"
                strokeWidth={1.5}
              />
              <line
                x1={centre - boxWidth / 4}
                x2={centre + boxWidth / 4}
                y1={toY(stats.lowerWhisker)}
                y2={toY(stats.lowerWhisker)}
                stroke="currentColor"
                strokeWidth={1.5}
              />

              {/* Interquartile box */}
              <rect
                x={centre - boxWidth / 2}
                y={boxTop}
                width={boxWidth}
                height={Math.max(1, boxBottom - boxTop)}
                fill="currentColor"
                fillOpacity={0.14}
                stroke="currentColor"
                strokeWidth={1.5}
                rx={3}
              />

              {/* Median */}
              <line
                x1={centre - boxWidth / 2}
                x2={centre + boxWidth / 2}
                y1={toY(stats.median)}
                y2={toY(stats.median)}
                stroke="currentColor"
                strokeWidth={2.5}
              />

              {/* Outliers beyond 1,5 × IQR */}
              {stats.outliers.map((value, i) => (
                <circle
                  key={`${value}-${i}`}
                  cx={centre}
                  cy={toY(value)}
                  r={2.5}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.2}
                />
              ))}

              <text
                x={centre}
                y={height - padding.bottom + 18}
                textAnchor="middle"
                className="fill-neutral-900 text-xs font-medium"
              >
                {entry.label}
              </text>
              <text
                x={centre}
                y={height - padding.bottom + 32}
                textAnchor="middle"
                className="fill-neutral-500 text-xs tabular-nums"
              >
                n = {stats.n} · med. {num(stats.median, 2)}
              </text>
            </g>
          );
        })}

        {unit !== '' ? (
          <text
            x={padding.left - 8}
            y={padding.top - 4}
            textAnchor="end"
            className="fill-neutral-500 text-xs"
          >
            {unit}
          </text>
        ) : null}
      </svg>

      <p className="px-1 pt-1 text-xs text-neutral-500">
        Caja: Q1–Q3 · línea gruesa: mediana · bigotes: 1,5 × RIC (Tukey) · círculos: valores atípicos.
      </p>
    </div>
  );
}
