'use client';

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Minus,
  Pencil,
  Stethoscope,
  Timer,
  TrendingDown,
  TrendingUp,
  UserX,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { SeverityEvolution, type SeverityPoint } from '@/components/charts/severity-evolution';
import { AiAssessment } from '@/components/portal/ai-assessment';
import { useSession } from '@/components/session-provider';
import { Badge, StudyModeBadge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ConfirmAction } from '@/components/ui/confirm';
import { Alert, ErrorState, Loading, StudyModeBlocked } from '@/components/ui/feedback';
import { api, type GetResult } from '@/lib/api';
import { cn } from '@/lib/cn';
import { date, dateTime, num, pct } from '@/lib/format';
import { useAction, useApi } from '@/lib/use-api';
import { igaLabel, useCatalogs, type Catalogs } from '@/lib/use-catalogs';
import { usePortalHref } from '@/lib/use-portal';

type PatientHistory = GetResult<'/patients/{id}/history'>;
type HistoryEntry = PatientHistory['timeline'][number];
type PatientSummary = PatientHistory['patient'];

const SEVERITY_VARIANT: Record<string, 'neutral' | 'success' | 'primary' | 'warning' | 'danger'> = {
  sin_lesiones: 'success',
  casi_sin_lesiones: 'success',
  leve: 'primary',
  moderado: 'warning',
  severo: 'danger',
};

const TREND_STYLE = {
  mejora: {
    label: 'Mejora',
    icon: TrendingDown,
    tone: 'text-emerald-700',
    note: 'La severidad IGA descendió respecto de la primera visita.',
  },
  empeora: {
    label: 'Empeora',
    icon: TrendingUp,
    tone: 'text-red-700',
    note: 'La severidad IGA subió respecto de la primera visita.',
  },
  estable: {
    label: 'Estable',
    icon: Minus,
    tone: 'text-neutral-500',
    note: 'La severidad IGA se mantiene igual que en la primera visita.',
  },
  sin_datos: {
    label: 'Sin evolución',
    icon: Minus,
    tone: 'text-neutral-500',
    note: 'Hacen falta al menos dos visitas diagnosticadas para hablar de evolución.',
  },
} as const;

/**
 * Longitudinal clinical history of one patient.
 *
 * Complements — it does not replace — the case screen. The case screen is where the experiment is
 * run on a single observation; this is the follow-up view: the whole course of the person's acne,
 * visit by visit, with the severity recorded at each one, who signed it, how long the review took
 * and what the model said. The AI column simply is not there in pretest, because the API sends
 * `inference: null` for a requester in that condition (RF-TR-01).
 */
export default function PacienteHistoriaPage() {
  const href = usePortalHref();
  const params = useParams<{ id: string }>();
  const { user } = useSession();
  const { data: catalogs } = useCatalogs();
  const [openCase, setOpenCase] = useState<string | null>(null);

  const history = useApi<PatientHistory>(`/patients/${params.id}/history`, {
    includeSynthetic: 'true',
  });

  if (history.loading && history.data === null) return <Loading label="Cargando historia…" />;
  if (history.error !== null) {
    return <ErrorState message={history.error.message} onRetry={history.reload} />;
  }
  if (history.data === null) return null;

  const { patient, summary, timeline } = history.data;
  const trend = TREND_STYLE[summary.trend as keyof typeof TREND_STYLE] ?? TREND_STYLE.sin_datos;
  const TrendIcon = trend.icon;

  const points: SeverityPoint[] = timeline
    .filter((entry): entry is HistoryEntry & { severity: string } => entry.severity !== null)
    .map((entry) => ({
      at: entry.createdAt,
      rank: catalogs?.iga.ordinal[entry.severity] ?? 0,
      label: igaLabel(catalogs, entry.severity),
      caseCode: entry.caseCode,
    }));

  return (
    <div className="space-y-5">
      <header>
        <Link
          href={href('/pacientes')}
          className="flex w-fit items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver al registro de pacientes
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">
          {patient.fullName ?? patient.patientCode}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <span className="font-mono text-xs">{patient.patientCode}</span>
          <span aria-hidden>·</span>
          <span>{patient.ageYears === null ? 'Edad no registrada' : `${patient.ageYears} años`}</span>
          <span aria-hidden>·</span>
          <span className="capitalize">{patient.sex ?? 'sexo no registrado'}</span>
          <span aria-hidden>·</span>
          <span>Fototipo {patient.fitzpatrickPhototype ?? '—'}</span>
          {patient.withdrawnAt !== null ? <Badge variant="outline">retirado del estudio</Badge> : null}
        </p>
      </header>

      {/* Two endpoints that had existed from the start with no screen anywhere: `withdraw` since
          the first migration, `reinstate` because until now a withdrawal could not be undone at
          all — a mistake at the intake desk removed a patient from the study permanently. */}
      <PatientAdminActions patient={patient} onChanged={history.reload} />

      {patient.fullName === null ? (
        <Alert tone="info" title="Historia en modo anonimizado">
          Su rol no accede a la identidad del paciente, de modo que la historia se muestra
          referenciada por el código <code>{patient.patientCode}</code> (RF-TR-03).
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={CalendarDays}
          label="Visitas registradas"
          value={String(summary.totalCases)}
          hint={
            summary.firstVisitAt === null
              ? 'Sin visitas'
              : `Desde ${date(summary.firstVisitAt)} · ${summary.closedCases} cerradas`
          }
        />
        <SummaryCard
          icon={Stethoscope}
          label="Severidad actual"
          value={igaLabel(catalogs, summary.lastSeverity)}
          hint={
            summary.firstSeverity === null
              ? 'Sin diagnóstico emitido'
              : `Al inicio: ${igaLabel(catalogs, summary.firstSeverity)}`
          }
        />
        <SummaryCard
          icon={TrendIcon}
          label="Evolución"
          value={trend.label}
          valueClassName={trend.tone}
          hint={
            summary.severityDelta === null
              ? trend.note
              : `${summary.severityDelta > 0 ? '+' : ''}${summary.severityDelta} escalón${
                  Math.abs(summary.severityDelta) === 1 ? '' : 'es'
                } IGA · ${trend.note}`
          }
        />
        <SummaryCard
          icon={Timer}
          label="Tiempo medio de revisión"
          value={summary.averageReviewMinutes === null ? '—' : `${num(summary.averageReviewMinutes)} min`}
          hint={`${summary.totalReviews} revisión${summary.totalReviews === 1 ? '' : 'es'} cronometrada${
            summary.totalReviews === 1 ? '' : 's'
          } (TRᵢ, Anexo 4)`}
        />
      </div>

      <Card>
        <CardHeader
          title="Curva de evolución IGA"
          description="Severidad clínica registrada por el especialista en cada visita. La escala es ordinal: la línea muestra la dirección y los escalones recorridos, no una distancia numérica."
        />
        <CardBody>
          <SeverityEvolution data={points} rankLabels={rankLabels(catalogs)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Cronología de visitas"
          description="Cada visita es un caso clínico con su fotografía, su diagnóstico y su tiempo de revisión."
        />
        <CardBody className="space-y-3">
          {timeline.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              Este paciente todavía no tiene casos registrados.
            </p>
          ) : (
            timeline.map((entry, index) => (
              <VisitRow
                key={entry.caseId}
                entry={entry}
                index={index}
                previous={index === 0 ? null : timeline[index - 1] ?? null}
                catalogs={catalogs}
                aiVisible
                expanded={openCase === entry.caseId}
                onToggle={() => setOpenCase((current) => (current === entry.caseId ? null : entry.caseId))}
              />
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** Ordinal rank → clinical label, for the chart's Y axis. */
function rankLabels(catalogs: Catalogs | null): Record<number, string> {
  const labels: Record<number, string> = {};
  for (const [igaClass, rank] of Object.entries(catalogs?.iga.ordinal ?? {})) {
    labels[rank] = catalogs?.iga.labels[igaClass] ?? igaClass.replace(/_/g, ' ');
  }
  return labels;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  valueClassName,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
  hint: string;
  valueClassName?: string;
}) {
  return (
    <Card>
      <CardBody className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </p>
        <p
          className={cn(
            'text-xl font-semibold tracking-tight text-neutral-900',
            valueClassName,
          )}
        >
          {value}
        </p>
        <p className="text-xs text-neutral-500">{hint}</p>
      </CardBody>
    </Card>
  );
}

/**
 * One visit in the timeline.
 *
 * Collapsed it shows what a physician scans for — when, what grade, and whether it moved since the
 * previous visit; expanded it shows the photograph, every diagnosis signed on the case, the
 * chronometry of both conditions and the model's suggestion.
 */
function VisitRow({
  entry,
  index,
  previous,
  catalogs,
  aiVisible,
  expanded,
  onToggle,
}: {
  entry: HistoryEntry;
  index: number;
  previous: HistoryEntry | null;
  catalogs: Catalogs | null;
  aiVisible: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const href = usePortalHref();
  const ordinal = catalogs?.iga.ordinal ?? {};
  const step =
    entry.severity === null || previous?.severity == null
      ? null
      : (ordinal[entry.severity] ?? 0) - (ordinal[previous.severity] ?? 0);

  const clinicalImage = entry.images.find((image) => !image.isHeatmap);

  return (
    <div className="rounded-md border border-neutral-200">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-neutral-100/60"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-900">
          {index + 1}
        </span>
        <span className="min-w-40">
          <span className="block text-sm font-medium text-neutral-900">
            {date(entry.createdAt)}
          </span>
          <span className="block font-mono text-xs text-neutral-500">
            {entry.caseCode}
          </span>
        </span>

        {entry.severity === null ? (
          <Badge variant="outline">sin diagnóstico</Badge>
        ) : (
          <Badge variant={SEVERITY_VARIANT[entry.severity] ?? 'neutral'}>
            {igaLabel(catalogs, entry.severity)}
          </Badge>
        )}

        {step === null || step === 0 ? null : (
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              step < 0
                ? 'text-emerald-700'
                : 'text-red-700',
            )}
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            {step < 0 ? 'bajó' : 'subió'} {Math.abs(step)} escalón{Math.abs(step) === 1 ? '' : 'es'}
          </span>
        )}

        {entry.isSynthetic ? <Badge variant="outline">sintético</Badge> : null}

        <span className="ml-auto text-xs text-neutral-500">
          {expanded ? 'Ocultar detalle' : 'Ver detalle'}
        </span>
      </button>

      {expanded ? (
        <div className="grid gap-4 border-t border-neutral-200 p-4 lg:grid-cols-[minmax(0,240px)_1fr]">
          <div>
            {clinicalImage === undefined ? (
              <p className="text-sm text-neutral-500">Sin imagen registrada.</p>
            ) : (
              /* Signed URL with a 15-minute TTL, served decrypted by the API (RNF-02). */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={api.url(clinicalImage.url.replace(/^\/api/, ''))}
                alt={`Fotografía clínica del caso ${entry.caseCode}`}
                className="w-full rounded-md border border-neutral-200 bg-neutral-100 object-contain"
              />
            )}
            <Link
              href={href(`/casos/${entry.caseId}`)}
              className="mt-2 flex items-center gap-1 text-sm font-medium text-purple-900 hover:underline"
            >
              Abrir la ficha del caso
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="space-y-4 text-sm">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Diagnósticos emitidos
              </h3>
              <div className="mt-2 space-y-2">
                {entry.diagnoses.length === 0 ? (
                  <p className="text-neutral-500">
                    Todavía no se ha emitido ningún diagnóstico en esta visita.
                  </p>
                ) : (
                  entry.diagnoses.map((diagnosis) => (
                    <div
                      key={diagnosis.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 px-3 py-2"
                    >
                      <StudyModeBadge mode={diagnosis.studyMode} />
                      <span className="font-medium text-neutral-900">
                        {igaLabel(catalogs, diagnosis.igaClass)}
                      </span>
                      {diagnosis.gagsScore !== null ? (
                        <span className="text-xs text-neutral-500">
                          GAGS {diagnosis.gagsScore}
                        </span>
                      ) : null}
                      <span className="ml-auto text-xs text-neutral-500">
                        {diagnosis.professional} · {dateTime(diagnosis.createdAt)}
                      </span>
                      {diagnosis.notes !== null && diagnosis.notes !== '' ? (
                        <p className="w-full text-xs text-neutral-500">
                          {diagnosis.notes}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Tiempos de revisión
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.timings.length === 0 ? (
                  <p className="text-neutral-500">Sin cronometrías registradas.</p>
                ) : (
                  entry.timings.map((timing) => (
                    <div
                      key={`${timing.studyMode}-${timing.t0}`}
                      className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2"
                    >
                      <StudyModeBadge mode={timing.studyMode} />
                      <span className="tabular-nums text-neutral-900">
                        {timing.reviewMinutes === null ? '—' : `${num(timing.reviewMinutes)} min`}
                      </span>
                      {!timing.valid ? <Badge variant="warning">descartada</Badge> : null}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Evaluación asistida
              </h3>
              <div className="mt-2">
                {/* `inference: null` has two very different meanings, and conflating them would
                    misreport the experiment: in pretest the API withholds the block by design
                    (RF-TR-01); in postest it means the case simply has no inference yet. */}
                {entry.inference === null ? (
                  aiVisible ? (
                    <p className="text-neutral-500">
                      Esta visita no tiene ningún análisis registrado.
                    </p>
                  ) : (
                    <StudyModeBlocked />
                  )
                ) : (
                  <div className="space-y-2 rounded-md border border-neutral-200 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-medium text-purple-900">
                        {igaLabel(catalogs, entry.inference.igaClass)}
                      </span>
                      <span className="text-xs text-neutral-500">
                        Confianza{' '}
                        {entry.inference.confidence === null
                          ? '—'
                          : pct(entry.inference.confidence * 100)}
                      </span>
                      <span className="ml-auto font-mono text-xs text-neutral-500">
                        {entry.inference.modelVersion}
                      </span>
                    </div>
                    {/* La lectura razonada, no solo la clase.
                        Se guardaba desde el principio y solo se veía en la ficha del caso abierto.
                        En una consulta de control lo que hace falta es poder releer POR QUÉ el
                        modelo dijo lo que dijo en la visita anterior: una clase suelta a seis meses
                        vista no se puede contrastar con nada. */}
                    {entry.inference.assessment !== null &&
                    entry.inference.assessment !== undefined ? (
                      <AiAssessment assessment={entry.inference.assessment} />
                    ) : null}

                    {entry.inference.modelBackend === 'stub' ? (
                      <p className="text-xs text-amber-600">
                        Modo de demostración: la sugerencia no proviene del clasificador entrenado y
                        no puede citarse como resultado.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            {entry.groundTruthIga !== null ? (
              <p className="text-xs text-neutral-500">
                Patrón de consenso del lote:{' '}
                <strong className="text-neutral-900">
                  {igaLabel(catalogs, entry.groundTruthIga)}
                </strong>{' '}
                — es el referente común que hace comparables pretest y postest (RF-OE2-05).
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Administrative actions on the record itself, as opposed to the clinical history above.
 *
 * Kept out of the page component because what they are allowed to do depends on the role in three
 * different ways, and inlining that would have buried the rules in the middle of a chart.
 *
 * Confirmation is an inline reveal rather than a dialog, so the patient code the administrator is
 * acting on stays on screen while they confirm.
 */
function PatientAdminActions({
  patient,
  onChanged,
}: {
  patient: PatientSummary;
  onChanged: () => void;
}): JSX.Element | null {
  const href = usePortalHref();
  const { user } = useSession();
  const { data: catalogs } = useCatalogs();

  const mayEdit = (catalogs?.roles.groups.intake ?? []).includes(user?.role ?? '');
  // Mirrors the API: whoever can take a patient out of the study can put them back.
  const mayWithdraw = user?.role === 'dermatologo' || user?.role === 'admin';

  const withdraw = useAction(async (reason: string) =>
    api.post(`/patients/${patient.id}/withdraw`, reason === '' ? {} : { notes: reason }),
  );
  const reinstate = useAction(async (reason: string) =>
    api.post(`/patients/${patient.id}/reinstate`, { notes: reason }),
  );

  if (!mayEdit && !mayWithdraw) return null;

  const withdrawn = patient.withdrawnAt !== null;

  return (
    <Card>
      <CardBody className="flex flex-wrap items-start gap-3">
        {mayEdit && !withdrawn ? (
          <Link
            href={href(`/pacientes/${patient.id}/editar`)}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Corregir ficha
          </Link>
        ) : null}

        {mayWithdraw && !withdrawn ? (
          <ConfirmAction
            label="Retirar del estudio"
            icon={<UserX className="h-4 w-4" aria-hidden />}
            title="El paciente saldrá del estudio"
            confirmLabel="Registrar retiro"
            requireReason
            reasonLabel="Motivo del retiro"
            pending={withdraw.pending}
            error={withdraw.error?.message ?? null}
            description={
              <>
                Sus casos dejarán de entrar en los indicadores y en las exportaciones, y su ficha no
                podrá corregirse. No se borra nada: queda registrado con fecha y motivo en el
                historial de consentimientos (RNF-07).
              </>
            }
            onConfirm={(reason) => {
              void withdraw.run(reason).then(onChanged);
            }}
          />
        ) : null}

        {mayWithdraw && withdrawn ? (
          <ConfirmAction
            label="Reincorporar al estudio"
            tone="warning"
            title="Sus casos volverán a los indicadores"
            confirmLabel="Registrar reincorporación"
            requireReason
            reasonLabel="Por qué se reincorpora"
            pending={reinstate.pending}
            error={reinstate.error?.message ?? null}
            description={
              <>
                Un cálculo de indicadores anterior dejará de coincidir con uno posterior, porque el
                conjunto de casos cambia. Úselo para <strong>corregir un retiro registrado por
                error</strong>, nunca para revertir la voluntad del paciente.
              </>
            }
            onConfirm={(reason) => {
              void reinstate.run(reason).then(onChanged);
            }}
          />
        ) : null}
      </CardBody>
    </Card>
  );
}
