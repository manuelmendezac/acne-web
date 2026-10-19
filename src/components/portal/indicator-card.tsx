'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { delta, num } from '@/lib/format';

import type { GetResult } from '@/lib/api';

/** One entry of `GET /indicators/dashboard`, taken straight from the generated contract. */
export type IndicatorComparison = GetResult<'/indicators/dashboard'>['indicators'][number];

/**
 * Indicator summary card.
 *
 * The arrow direction is judged against the indicator's own `direction`, not against the sign of
 * the change: for TRM a DROP is the good outcome, for the other three it is a rise. Colouring by
 * raw sign would paint the headline result of OE1 red.
 */
export function IndicatorCard({ data }: { data: IndicatorComparison }) {
  const { definition } = data;
  const change = data.relativeChangePct;

  const improved =
    change === null ? null : definition.direction === 'lower' ? change < 0 : change > 0;

  const ArrowIcon = change === null ? Minus : change < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <Card className={cn(data.targetMet === false && 'border-amber-500/50')}>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              {definition.objective}
              <span aria-hidden>·</span>
              {data.indicator}
            </p>
            <h3 className="mt-0.5 truncate text-sm font-semibold text-neutral-900">
              {definition.name}
            </h3>
          </div>
          {data.targetMet === null ? (
            <Badge variant="outline">Sin datos</Badge>
          ) : data.targetMet ? (
            <Badge variant="success">Cumple meta</Badge>
          ) : (
            <Badge variant="warning">No cumple</Badge>
          )}
        </div>

        <div className="flex items-end gap-4">
          <div>
            <p className="text-xs text-neutral-500">Pretest</p>
            <p className="text-xl font-semibold tabular-nums text-neutral-500">
              {data.pretest === null ? '—' : num(data.pretest.value)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Postest</p>
            <p className="text-2xl font-bold tabular-nums text-purple-900">
              {data.postest === null ? '—' : num(data.postest.value)}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-neutral-500">{definition.unit}</p>
            <p
              className={cn(
                'flex items-center justify-end gap-0.5 text-sm font-semibold tabular-nums',
                improved === null
                  ? 'text-neutral-500'
                  : improved
                    ? 'text-emerald-700'
                    : 'text-red-700',
              )}
            >
              <ArrowIcon className="h-3.5 w-3.5" aria-hidden />
              {delta(change)}
            </p>
          </div>
        </div>

        <p className="text-xs text-neutral-500">
          <span className="font-mono">{definition.formula}</span> · Meta: {definition.target}
        </p>

        {data.alert !== null ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-neutral-900">
            {data.alert}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
