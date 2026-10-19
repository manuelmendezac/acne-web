'use client';

import { CalendarClock, ClipboardList, ImageIcon, Pill, Stethoscope, Timer } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { cn } from '@/lib/cn';

/**
 * La cabecera de la ficha: de quién es este caso y en qué punto está.
 *
 * Antes había que leer una línea de texto pequeño bajo el título para saber a qué paciente se
 * estaba diagnosticando. En una consulta con el paciente delante eso es exactamente el dato que
 * tiene que estar a la vista, no el que hay que buscar.
 *
 * El avatar es la inicial y no una fotografía: no hay retrato del paciente en el sistema, y la
 * inicial basta para que el ojo distinga una ficha de otra al cambiar de caso.
 */
export function CaseHeader({
  caseCode,
  statusLabel,
  patientName,
  patientCode,
  ageYears,
  sexLabel,
  phone,
  isSynthetic,
  action,
}: {
  caseCode: string;
  statusLabel: string;
  patientName: string | null;
  patientCode: string;
  ageYears: number | null;
  sexLabel: string | null;
  phone: string | null;
  isSynthetic: boolean;
  action?: ReactNode;
}): JSX.Element {
  const displayName = patientName ?? patientCode;
  const facts = [
    ageYears === null ? null : { label: 'Edad', value: `${ageYears} años` },
    sexLabel === null ? null : { label: 'Sexo', value: sexLabel },
    phone === null ? null : { label: 'Tel', value: phone },
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <Card>
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-2xl font-bold text-purple-900"
        >
          {displayName.charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-neutral-900">{displayName}</h1>
            <Badge variant="neutral">{statusLabel}</Badge>
            {isSynthetic ? <Badge variant="outline">sintético</Badge> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span className="font-mono">{caseCode}</span>
            <span className="font-mono">{patientCode}</span>
            {facts.map((fact) => (
              <span key={fact.label}>
                <span className="font-medium text-neutral-900">{fact.label}:</span> {fact.value}
              </span>
            ))}
          </div>
        </div>

        {action !== undefined ? <div className="shrink-0">{action}</div> : null}
      </CardBody>
    </Card>
  );
}

/**
 * La fila de cifras del caso, para no tener que recorrer la ficha entera.
 *
 * Cuatro y no más: el tiempo que llevó la revisión, la severidad que se firmó, cuántas recetas
 * salieron y cuántas fotografías hay. Es lo que alguien pregunta al abrir un caso ajeno.
 */
export function CaseStats({
  reviewMinutes,
  severityLabel,
  prescriptions,
  images,
}: {
  reviewMinutes: string | null;
  severityLabel: string | null;
  prescriptions: number;
  images: number;
}): JSX.Element {
  const tiles = [
    {
      icon: <Timer className="h-4 w-4" aria-hidden />,
      label: 'Revisión',
      value: reviewMinutes ?? '—',
      tone: 'bg-purple-50 text-purple-900',
    },
    {
      icon: <Stethoscope className="h-4 w-4" aria-hidden />,
      label: 'Severidad',
      value: severityLabel ?? 'Sin diagnóstico',
      tone: 'bg-neutral-100 text-neutral-600',
    },
    {
      icon: <Pill className="h-4 w-4" aria-hidden />,
      label: 'Recetas',
      value: String(prescriptions),
      tone: 'bg-neutral-100 text-neutral-600',
    },
    {
      icon: <ImageIcon className="h-4 w-4" aria-hidden />,
      label: 'Imágenes',
      value: String(images),
      tone: 'bg-neutral-100 text-neutral-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
        >
          <span
            className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tile.tone)}
          >
            {tile.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium text-neutral-500">{tile.label}</span>
            <span className="block truncate text-sm font-semibold text-neutral-900">
              {tile.value}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Una visita del paciente en la línea de tiempo. */
export interface VisitEntry {
  caseId: string;
  caseCode: string;
  createdAt: string;
  severityLabel: string | null;
  statusLabel: string;
}

/**
 * Las visitas anteriores del paciente, con la actual marcada.
 *
 * El contexto de evolución mientras se diagnostica: una severidad que baja de moderado a leve dice
 * algo que la fotografía de hoy, sola, no dice. Antes había que abandonar la ficha e ir a la
 * pantalla de pacientes para verlo, que es justo lo que nadie hace con el paciente esperando.
 */
export function VisitTimeline({
  visits,
  currentCaseId,
  onOpen,
  formatDate,
}: {
  visits: VisitEntry[];
  currentCaseId: string;
  onOpen: (caseId: string) => void;
  formatDate: (iso: string) => string;
}): JSX.Element {
  return (
    <div className="relative">
      {/* La guía vertical que une los puntos. Decorativa: el orden ya lo da el DOM. */}
      <div aria-hidden className="absolute bottom-3 left-[7px] top-3 w-px bg-neutral-200" />
      <ol className="space-y-2">
        {visits.map((visit) => {
          const current = visit.caseId === currentCaseId;
          return (
            <li key={visit.caseId} className="relative pl-6">
              <span
                aria-hidden
                className={cn(
                  'absolute left-0 top-3 h-3.5 w-3.5 rounded-full border-2 border-white',
                  current ? 'bg-purple-900' : 'bg-neutral-300',
                )}
              />
              <button
                type="button"
                disabled={current}
                onClick={() => onOpen(visit.caseId)}
                aria-current={current ? 'true' : undefined}
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  current
                    ? 'cursor-default border-purple-900 bg-purple-50'
                    : 'border-neutral-200 hover:border-purple-900 hover:bg-neutral-50',
                )}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                  <span className="text-xs text-neutral-500">{formatDate(visit.createdAt)}</span>
                  <span className="font-mono text-xs text-neutral-500">{visit.caseCode}</span>
                  {current ? <Badge variant="primary">esta visita</Badge> : null}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                  <span className="text-neutral-900">
                    {visit.severityLabel ?? 'Sin diagnóstico'}
                  </span>
                  <span className="text-xs text-neutral-500">· {visit.statusLabel}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
