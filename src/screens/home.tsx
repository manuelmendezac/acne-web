'use client';

import { AlertTriangle, ArrowRight, FileDown } from 'lucide-react';
import Link from 'next/link';

import { useSession } from '@/components/session-provider';
import { IndicatorCard } from '@/components/portal/indicator-card';
import { PageHeader } from '@/components/portal/page-header';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert, Loading } from '@/components/ui/feedback';
import { api, type GetResult } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { hasSection } from '@/lib/portals';
import { useCatalogs } from '@/lib/use-catalogs';
import { usePortal } from '@/lib/use-portal';

type Dashboard = GetResult<'/indicators/dashboard'>;
type Coverage = GetResult<'/audit/thesis-coverage'>;
type SurveyStatus = GetResult<'/surveys/status'>;

const REPORTS = [
  { key: 'indicadores', file: 'REPORTE-INDICADORES', label: 'Indicadores', objective: 'OE1–OE4' },
  {
    key: 'contraste-hipotesis',
    file: 'REPORTE-CONTRASTE-HIPOTESIS',
    label: 'Contraste de hipótesis',
    objective: 'OG · HE₁–HE₄',
  },
  { key: 'usabilidad', file: 'REPORTE-USABILIDAD', label: 'Usabilidad', objective: 'OE3' },
  {
    key: 'evaluacion-modelo',
    file: 'REPORTE-EVALUACION-MODELO',
    label: 'Evaluación del modelo',
    objective: 'OE2',
  },
] as const;

/** El recorrido del mostrador, en el orden en que ocurre con el paciente delante. */
const INTAKE_STEPS = [
  {
    path: '/pacientes/nuevo',
    label: 'Registrar al paciente',
    hint: 'Solo si es su primera visita al centro.',
  },
  {
    path: '/casos/nuevo',
    label: 'Abrir el caso y tomar la anamnesis',
    hint: 'Las 21 preguntas del cuestionario de ingreso.',
  },
  {
    path: '/casos',
    label: 'Tomar las fotografías con el teléfono',
    hint: 'Desde la ficha del caso, escaneando el código QR.',
  },
] as const;

/** El recorrido de la consulta, en el orden en que ocurre. */
const CONSULT_STEPS = [
  {
    path: '/jornada',
    label: 'Abrir la jornada',
    hint: 'Sin jornada abierta, los casos que revise no cuentan para la capacidad de atención.',
  },
  {
    path: '/casos',
    label: 'Revisar y diagnosticar',
    hint: 'El cronómetro corre desde que abre la ficha hasta que firma el diagnóstico.',
  },
  {
    path: '/encuesta',
    label: 'Responder la encuesta',
    hint: 'Una sola vez, cuando el sistema se lo indique.',
  },
] as const;

export default function PortalHomePage() {
  const { portal, href } = usePortal();
  const { user } = useSession();
  const { data: catalogs } = useCatalogs();

  /**
   * Which blocks this portal's home shows, asked of the portal definition rather than of the role.
   *
   * The three portals share this screen, and before the split it showed everything to everyone:
   * the intake desk was being offered the objective-coverage card, the four thesis reports and a
   * link to an audit panel its portal does not have. Every one of those calls answers 403 for a
   * technician, so the page rendered a heading with nothing under it and a link that led to
   * "sección no disponible" — a broken product, not a boundary.
   *
   * Deriving it from `hasSection` means a section moved between portals takes its card with it,
   * with no second list to keep in step.
   */
  const showsIndicators = hasSection(portal, '/indicadores');
  const showsCoverage = hasSection(portal, '/auditoria');
  const showsReports = hasSection(portal, '/anexos');
  const showsSurvey = hasSection(portal, '/encuesta');
  /**
   * Quién es cada portal, preguntado por lo único que de verdad los separa: quién diagnostica.
   *
   * Este predicado ya se equivocó dos veces por elegir un atajo. Primero fue «no tiene
   * indicadores», que dejó de distinguir a nadie en cuanto los indicadores pasaron a ser
   * exclusivos del administrador, y el dermatólogo acabó viendo el recorrido del mostrador.
   * Después fue «no tiene jornada», que duró hasta que el mostrador también registró la suya.
   *
   * Diagnosticar es la frontera estable: es la razón por la que los dos puestos existen por
   * separado, y se lee del grupo de roles que sirve la API en vez de deducirse de una sección.
   */
  const showsJourney = hasSection(portal, '/jornada');
  const diagnoses = (catalogs?.roles.groups.diagnosing ?? []).includes(portal.role);
  const isIntakeDesk = !diagnoses;

  // `null` skips the request entirely: asking for data this portal may not read would add a 403 to
  // the audit trail on every visit to the home page.
  const dashboard = useApi<Dashboard>(
    showsIndicators ? '/indicators/dashboard' : null,
    { includeSynthetic: true },
  );
  const coverage = useApi<Coverage>(showsCoverage || showsReports ? '/audit/thesis-coverage' : null);
  const survey = useApi<SurveyStatus>(showsSurvey ? '/surveys/status' : null);

  return (
    <div className="space-y-6">
      {/* El encuadre del experimento solo le dice algo a quien participa de él. Al mostrador se le
          dice en qué consiste su puesto, que es lo que esta pantalla debe contestarle. */}
      <PageHeader
        title={`Hola, ${user?.fullName ?? ''}`}
        description={
          showsIndicators
            ? 'Diseño preexperimental pretest–postest de un solo grupo · G: O₁ → X → O₂ · censo de 30 casos.'
            : portal.purpose
        }
      />

      {showsSurvey && survey.data?.due === true ? (
        <Alert tone="info" title="Le corresponde responder el cuestionario de satisfacción">
          Ha completado {survey.data.postestCasesCompleted} casos en postest, el umbral configurado
          es {survey.data.triggerThreshold}. El instrumento del Anexo 6 se aplica una única vez por
          profesional.
          <Link
            href={href('/encuesta')}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-purple-900 hover:underline"
          >
            Responder ahora <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Alert>
      ) : null}

      {showsCoverage && (coverage.data?.blockers ?? []).length > 0 ? (
        <Alert tone="warning" title="La cobertura de objetivos no está completa">
          <ul className="list-disc space-y-1 pl-4">
            {(coverage.data?.blockers ?? []).map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {showsIndicators ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-neutral-900">
            Indicadores de la variable dependiente
          </h2>
          {dashboard.loading ? (
            <Loading />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(dashboard.data?.indicators ?? []).map((indicator) => (
                <IndicatorCard key={indicator.indicator} data={indicator} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {showsCoverage ? (
        <Card>
          <CardHeader
            title="Cobertura de objetivos (RNF-04)"
            description="La cobertura se calcula, no se declara."
            action={
              <Badge
                variant={
                  (coverage.data?.coveragePct ?? 0) === 100
                    ? 'success'
                    : (coverage.data?.coveragePct ?? 0) >= 50
                      ? 'warning'
                      : 'danger'
                }
              >
                {coverage.data?.coveragePct ?? 0} %
              </Badge>
            }
          />
          <CardBody className="space-y-2">
            {(coverage.data?.entries ?? []).map((entry) => (
              <div
                key={entry.objective}
                className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 text-sm"
              >
                <span className="font-medium text-neutral-900">{entry.objective}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-neutral-500">
                  {entry.indicator ?? '—'}
                </span>
                <Badge
                  variant={
                    entry.status === 'cubierto'
                      ? 'success'
                      : entry.status === 'parcial'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {entry.statusLabel}
                </Badge>
              </div>
            ))}
            <Link
              href={href('/auditoria')}
              className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-purple-900 hover:underline"
            >
              Ver panel de auditoría <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </CardBody>
        </Card>
        ) : null}

        {showsReports ? (
        <Card>
          <CardHeader
            title="Entregables de la tesis"
            description="Los cuatro reportes de la Sección 11, generados por el sistema."
          />
          <CardBody className="space-y-2">
            {REPORTS.map((report) => (
              <button
                key={report.key}
                type="button"
                onClick={() =>
                  void api.download(
                    `/reports/${report.key}/pdf?includeSynthetic=true`,
                    `${report.file}.pdf`,
                  )
                }
                className="flex w-full items-center gap-3 rounded-md border border-neutral-200 px-3 py-2 text-left text-sm transition-colors hover:border-purple-900 hover:bg-neutral-100"
              >
                <FileDown className="h-4 w-4 shrink-0 text-purple-900" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-neutral-900">{report.label}</span>
                  <span className="block text-xs text-neutral-500">{report.objective}</span>
                </span>
              </button>
            ))}
            <p className="flex items-start gap-2 pt-1 text-xs text-neutral-500">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
              La primera generación puede tardar: el servidor arranca Chromium para renderizar el
              PDF.
            </p>
          </CardBody>
        </Card>
        ) : null}
      </div>

      {/* El portal de admisión no lee nada del estudio, de modo que sin esta tarjeta su resumen
          sería un saludo y un botón. Enumera lo que sí es su trabajo, en el orden en que ocurre. */}
      {isIntakeDesk ? (
        <Card>
          <CardHeader
            title="El ingreso, paso a paso"
            description="Cada paso abre la pantalla donde se hace."
          />
          <CardBody className="space-y-2">
            {INTAKE_STEPS.map((step, index) => (
              <Link
                key={step.path}
                href={href(step.path)}
                className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2 text-sm transition-colors hover:border-purple-900 hover:bg-neutral-100"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-50 text-xs font-semibold text-purple-900">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-neutral-900">{step.label}</span>
                  <span className="block text-xs text-neutral-500">{step.hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {diagnoses && showsJourney ? (
        <Card>
          <CardHeader
            title="Su jornada"
            description="Abra la jornada antes de revisar: es lo que permite medir cuántos casos atiende por hora."
          />
          <CardBody className="space-y-2">
            {CONSULT_STEPS.map((step, index) => (
              <Link
                key={step.path}
                href={href(step.path)}
                className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2 text-sm transition-colors hover:border-purple-900 hover:bg-neutral-100"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-50 text-xs font-semibold text-purple-900">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-neutral-900">{step.label}</span>
                  <span className="block text-xs text-neutral-500">{step.hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Link href={href('/casos')} className={buttonVariants({ variant: 'primary' })}>
        Ir a la bandeja de casos
      </Link>
    </div>
  );
}
