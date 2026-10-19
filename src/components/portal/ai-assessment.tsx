'use client';

import { AlertTriangle, ClipboardList, MapPin, Scale, Stethoscope } from 'lucide-react';

import type { components } from '@/types/api-schema';

type Assessment = components['schemas']['AiAssessmentDto'];

/**
 * The model's reasoned reading of the case.
 *
 * A class plus a probability bar tells the physician *what* the model concluded and nothing about
 * *why*, and a suggestion that cannot be inspected can only be trusted or ignored — neither of
 * which is clinical judgement. Everything here is the model's own account so the specialist can
 * disagree with the reasoning rather than with a label.
 *
 * Ordering is deliberate: the reading first, then what grounds it, then the flags that change
 * management. `anamnesisFlags` sits in a warning tone because it is the only block that can carry
 * something the physician must not miss — a possible pregnancy against isotretinoin, an allergy,
 * a drug already in use.
 */
export function AiAssessment({
  assessment,
  title = 'Lectura asistida',
}: {
  assessment: Assessment;
  title?: string;
}): JSX.Element {
  return (
    <div className="space-y-4 border-t border-neutral-200 pt-4">
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Stethoscope className="h-3.5 w-3.5" aria-hidden />
          {title}
        </p>
        <p className="text-sm leading-relaxed text-neutral-700">
          {assessment.summary}
        </p>
      </div>

      {assessment.severityRationale !== '' ? (
        <div className="rounded-md bg-neutral-50 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Scale className="h-3.5 w-3.5" aria-hidden />
            Por qué esta clase y no la contigua
          </p>
          <p className="text-sm leading-relaxed text-neutral-700">
            {assessment.severityRationale}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <ChipList title="Lesiones observadas" items={assessment.lesionTypes} />
        <ChipList
          title="Zonas comprometidas"
          items={assessment.affectedZones}
          icon={<MapPin className="h-3.5 w-3.5" aria-hidden />}
        />
      </div>

      {assessment.anamnesisFlags.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Lo que aporta la anamnesis
          </p>
          <Bullets items={assessment.anamnesisFlags} tone="warning" />
        </div>
      ) : null}

      {assessment.differentials.length > 0 ? (
        <Block title="Diagnósticos diferenciales a descartar" items={assessment.differentials} />
      ) : null}

      {assessment.considerations.length > 0 ? (
        <Block
          title="Aspectos de manejo a valorar"
          items={assessment.considerations}
          icon={<ClipboardList className="h-3.5 w-3.5" aria-hidden />}
        />
      ) : null}
    </div>
  );
}

function Block({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon?: JSX.Element;
}): JSX.Element {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        {icon}
        {title}
      </p>
      <Bullets items={items} tone="neutral" />
    </div>
  );
}

function Bullets({ items, tone }: { items: string[]; tone: 'neutral' | 'warning' }): JSX.Element {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li
          key={item}
          className={
            tone === 'warning'
              ? 'flex gap-2 text-sm text-amber-900'
              : 'flex gap-2 text-sm text-neutral-700'
          }
        >
          <span aria-hidden className="select-none opacity-60">
            ·
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ChipList({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon?: JSX.Element;
}): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        {icon}
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-700"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
