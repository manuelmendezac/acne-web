'use client';

import { ArrowLeft, Camera, Check, ClipboardList, Lock, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AnamnesisForm, type AnamnesisAnswers } from '@/components/portal/anamnesis-form';
import { AnalysisPanel } from '@/components/portal/analysis-panel';
import { CaptureQrPanel, type CaseImage } from '@/components/portal/capture-qr-panel';
import { PatientFields } from '@/components/portal/patient-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { Alert, ErrorState, Loading } from '@/components/ui/feedback';
import { api, type GetResult, type PostResult } from '@/lib/api';
import { cn } from '@/lib/cn';
import { date } from '@/lib/format';
import { listShotLabels, missingRequiredShots } from '@/lib/shots';
import { useAction, useApi, useDebouncedValue } from '@/lib/use-api';
import { anamnesisQuestionsFor, useCatalogs } from '@/lib/use-catalogs';
import { usePortalHref } from '@/lib/use-portal';

type Patient = GetResult<'/patients'>[number];
type CaseSummary = PostResult<'/cases'>;
/**
 * The endpoint answers `null` for a patient with no previous visit. OpenAPI describes only the
 * success shape — a response body of `null` has no schema to declare — so the nullability is
 * restated here rather than inferred.
 */
type AnamnesisPrefill = GetResult<'/patients/{patientId}/anamnesis/latest'> | null;

/**
 * Case intake, on a single screen.
 *
 * Everything administrative — registering the patient, taking the history, collecting the
 * photographs — happens HERE, before the case file is ever opened for review. The chronometer that
 * OE1 reports as review time starts at `POST /cases/:id/open` (RF-OE1-01), so nothing typed on this
 * page can inflate the TRM the thesis measures. Putting the questionnaire on the case screen
 * instead would have quietly added a minute of typing to every observation in both conditions.
 *
 * The three blocks are all visible from the first render, so whoever is at the desk can see the
 * whole shape of the intake at once. Two of them stay locked until the case exists, and that is a
 * real dependency rather than a pacing device: the anamnesis and the photographs both attach to a
 * case id, so there is nothing to attach them to until the first block has been submitted. The case
 * starts as `draft` and only enters the tray once it has content.
 */
export default function NuevoCasoPage() {
  const href = usePortalHref();
  const router = useRouter();
  const {
    data: catalogs,
    error: catalogsError,
    loading: catalogsLoading,
    reload: reloadCatalogs,
  } = useCatalogs();

  // --- Patient ---------------------------------------------------------------
  const [fullName, setFullName] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState('');
  const [fitzpatrick, setFitzpatrick] = useState('');
  const [consent, setConsent] = useState(false);
  const [groundTruth, setGroundTruth] = useState('');

  const [patientSearch, setPatientSearch] = useState('');
  const [existingPatientId, setExistingPatientId] = useState('');
  const debouncedPatientSearch = useDebouncedValue(patientSearch.trim());
  const existing = useApi<Patient[]>('/patients', {
    search: debouncedPatientSearch === '' ? undefined : debouncedPatientSearch,
  });

  // --- Created records -------------------------------------------------------
  const [patient, setPatient] = useState<Patient | null>(null);
  const [clinicalCase, setClinicalCase] = useState<CaseSummary | null>(null);

  // --- Anamnesis -------------------------------------------------------------
  const [answers, setAnswers] = useState<AnamnesisAnswers>({});
  const [prefill, setPrefill] = useState<AnamnesisPrefill>(null);
  const [anamnesisSaved, setAnamnesisSaved] = useState(false);

  // --- Photographs -----------------------------------------------------------
  const [images, setImages] = useState<CaseImage[]>([]);
  const imageCount = images.length;
  const missingShots = missingRequiredShots(images, catalogs?.shots?.definitions ?? []);

  const selectedExisting = (existing.data ?? []).find((p) => p.id === existingPatientId) ?? null;

  const startCase = useAction(async () => {
    let target = selectedExisting;

    if (target === null) {
      target = await api.post<Patient>('/patients', {
        fullName,
        documentId: documentId === '' ? undefined : documentId,
        phone: phone === '' ? undefined : phone,
        email: email === '' ? undefined : email,
        birthDate: birthDate === '' ? undefined : birthDate,
        sex: sex === '' ? undefined : sex,
        fitzpatrickPhototype: fitzpatrick === '' ? undefined : fitzpatrick,
        consentAccepted: consent,
      });
    }

    const created = await api.post<CaseSummary>('/cases', {
      patientId: target.id,
      groundTruthIga: groundTruth === '' ? undefined : groundTruth,
    });

    // A returning patient usually has most of the answers already; offering them beats retyping.
    const previous = await api.getPath<AnamnesisPrefill>(
      `/patients/${target.id}/anamnesis/latest`,
      { excludeCaseId: created.id },
    );

    setPatient(target);
    setClinicalCase(created);
    setPrefill(previous);
    return created;
  });

  const saveAnamnesis = useAction(async (complete: boolean) => {
    if (clinicalCase === null) return null;
    const result = await api.put(`/cases/${clinicalCase.id}/anamnesis`, {
      answers,
      complete,
      prefilledFromCaseId: prefill?.caseId ?? null,
    });
    setAnamnesisSaved(true);
    return result;
  });

  const ageYears = patient?.ageYears ?? ageFrom(birthDate);
  const patientSex = patient?.sex ?? (sex === '' ? null : sex);
  const applicable = anamnesisQuestionsFor(catalogs, patientSex, ageYears).length;
  const answeredCount = Object.values(answers).filter(
    (a) => a.value !== null || (a.detail ?? '') !== '',
  ).length;

  const created = clinicalCase !== null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <Link
          href={href('/casos')}
          className="flex w-fit items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a la bandeja
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">
          Nuevo caso
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Todo el ingreso ocurre antes de abrir la ficha, de modo que no cuenta como tiempo de
          revisión médica (OE1).
        </p>
      </header>

      {/* --- Paciente ------------------------------------------------------- */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-neutral-500" aria-hidden />
              Paciente
            </span>
          }
          description={
            created
              ? 'El caso ya está creado. Los datos del paciente se corrigen desde su ficha.'
              : 'Busque un paciente ya registrado o dé de alta uno nuevo.'
          }
          action={
            created ? (
              <Badge variant="success">
                <Check className="mr-1 h-3 w-3" aria-hidden />
                Listo
              </Badge>
            ) : null
          }
        />
        <CardBody className="space-y-4">
          {created ? (
            <Alert tone="success" title={`Caso ${clinicalCase.caseCode} creado`}>
              {patient?.fullName ?? patient?.patientCode} · {patient?.patientCode}
              {groundTruth === ''
                ? ''
                : ` · patrón ${catalogs?.iga.labels[groundTruth] ?? groundTruth}`}
            </Alert>
          ) : (
            <>
              <Field
                label="Paciente ya registrado"
                hint="Busque por nombre o por código. Déjelo vacío para registrar uno nuevo."
              >
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                    aria-hidden
                  />
                  <Input
                    value={patientSearch}
                    onChange={(event) => setPatientSearch(event.target.value)}
                    placeholder="Nombre o código del paciente…"
                    className="pl-9"
                    aria-label="Buscar paciente"
                  />
                </div>
                {patientSearch.trim() !== '' ? (
                  <Select
                    value={existingPatientId}
                    onChange={(event) => setExistingPatientId(event.target.value)}
                    className="mt-2"
                    aria-label="Elegir paciente registrado"
                  >
                    <option value="">Registrar un paciente nuevo</option>
                    {(existing.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName ?? p.patientCode} · {p.patientCode}
                        {p.caseCount > 0 ? ` · ${p.caseCount} visita(s)` : ''}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </Field>

              {selectedExisting === null ? (
                <div className="space-y-4 border-t border-neutral-200 pt-4">
                  <PatientFields
                    values={{ fullName, documentId, phone, email, birthDate, sex, fitzpatrick }}
                    onChange={(values) => {
                      setFullName(values.fullName);
                      setDocumentId(values.documentId);
                      setPhone(values.phone);
                      setEmail(values.email);
                      setBirthDate(values.birthDate);
                      setSex(values.sex);
                      setFitzpatrick(values.fitzpatrick);
                    }}
                  />

                  <Checkbox
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    label={
                      <>
                        El paciente otorgó su consentimiento informado para el uso de sus imágenes
                        con fines de investigación académica.{' '}
                        <span className="text-neutral-500">
                          Obligatorio (RNF-07, Ley N.º 29733).
                        </span>
                      </>
                    }
                  />
                </div>
              ) : (
                <Alert
                  tone="info"
                  title={selectedExisting.fullName ?? selectedExisting.patientCode}
                >
                  {selectedExisting.patientCode} · {selectedExisting.ageYears ?? '—'} años ·{' '}
                  {selectedExisting.sex ?? 'sexo no registrado'} · {selectedExisting.caseCount}{' '}
                  visita(s) previa(s)
                </Alert>
              )}

              <Field
                label="Patrón de consenso IGA"
                hint="Etiqueta de referencia del lote. Es lo que hace comparables pretest y postest (RF-OE2-05). Puede dejarse vacío."
              >
                <Select
                  value={groundTruth}
                  onChange={(event) => setGroundTruth(event.target.value)}
                >
                  <option value="">Sin definir</option>
                  {(catalogs?.iga.classes ?? []).map((value) => (
                    <option key={value} value={value}>
                      {catalogs?.iga.labels[value] ?? value}
                    </option>
                  ))}
                </Select>
              </Field>

              {startCase.error !== null ? (
                <Alert tone="danger" title="No se pudo iniciar el caso">
                  {startCase.error.message}
                </Alert>
              ) : null}

              <Button
                block
                loading={startCase.pending}
                disabled={selectedExisting === null && (fullName === '' || !consent)}
                onClick={() => void startCase.run()}
              >
                Crear el caso y continuar abajo
              </Button>
              <p className="text-xs text-neutral-500">
                La anamnesis y las fotografías se guardan contra el caso, así que necesitan que
                exista primero. No abre la ficha ni inicia el cronómetro.
              </p>
            </>
          )}
        </CardBody>
      </Card>

      {/* --- Anamnesis ------------------------------------------------------ */}
      <Card className={cn(!created && 'opacity-60')}>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-neutral-500" aria-hidden />
              Anamnesis
            </span>
          }
          description="Las 21 preguntas del cuestionario de ingreso. Se registran igual en todas las fases del estudio."
          action={
            created && anamnesisSaved ? (
              <Badge variant="success">
                <Check className="mr-1 h-3 w-3" aria-hidden />
                {answeredCount} de {applicable}
              </Badge>
            ) : null
          }
        />
        <CardBody className="space-y-4">
          {!created ? (
            <LockedNote>Cree el caso arriba para registrar la anamnesis.</LockedNote>
          ) : catalogs === null ? (
            // The questionnaire is served by the API. Without it the form has nothing to render,
            // and "0 de 0 preguntas" said nothing about why — now it says, and can retry.
            catalogsLoading ? (
              <Loading label="Cargando el cuestionario…" />
            ) : (
              <ErrorState
                message={`No se pudo cargar el cuestionario de anamnesis${
                  catalogsError !== null ? `: ${catalogsError.message}` : ''
                }. Compruebe que la API esté disponible y reintente.`}
                onRetry={reloadCatalogs}
              />
            )
          ) : (
            <>
              <AnamnesisForm
                catalogs={catalogs}
                sex={patientSex}
                ageYears={ageYears}
                answers={answers}
                onChange={setAnswers}
                prefill={
                  prefill === null
                    ? null
                    : { caseCode: prefill.caseCode, visitedAt: prefill.visitedAt }
                }
                onApplyPrefill={() => {
                  if (prefill !== null) setAnswers(prefill.answers as AnamnesisAnswers);
                }}
                disabled={saveAnamnesis.pending}
              />

              {saveAnamnesis.error !== null ? (
                <Alert tone="danger" title="No se pudo guardar la anamnesis">
                  {saveAnamnesis.error.message}
                </Alert>
              ) : null}

              <Button loading={saveAnamnesis.pending} onClick={() => void saveAnamnesis.run(true)}>
                Guardar anamnesis
              </Button>
            </>
          )}
        </CardBody>
      </Card>

      {/* --- Fotografías ---------------------------------------------------- */}
      {created ? (
        <CaptureQrPanel
          caseId={clinicalCase.id}
          caseCode={clinicalCase.caseCode}
          onImagesChanged={setImages}
        />
      ) : (
        <Card className="opacity-60">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-neutral-500" aria-hidden />
                Fotografías
              </span>
            }
            description="Código QR para tomarlas desde el teléfono, o subida desde este equipo."
          />
          <CardBody>
            <LockedNote>Cree el caso arriba para abrir el código QR de captura.</LockedNote>
          </CardBody>
        </Card>
      )}

      {/* --- Análisis -------------------------------------------------------
          Después de las fotografías y antes del cierre, que es el orden real del ingreso: se
          fotografía, se analiza, y recién entonces se decide si el caso se manda a revisión. */}
      {created ? (
        <AnalysisPanel
          caseId={clinicalCase.id}
          imageCount={imageCount}
          missingShots={missingShots}
          anamnesisReady={anamnesisSaved}
        />
      ) : null}

      {/* --- Cierre --------------------------------------------------------- */}
      {created ? (
        <Card>
          <CardHeader title="Terminar el ingreso" />
          <CardBody className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <SummaryItem label="Caso" value={clinicalCase.caseCode} mono />
              <SummaryItem
                label="Paciente"
                value={`${patient?.fullName ?? patient?.patientCode ?? '—'} (${patient?.patientCode ?? '—'})`}
              />
              <SummaryItem
                label="Anamnesis"
                value={
                  anamnesisSaved ? `${answeredCount} de ${applicable} preguntas` : 'Sin registrar'
                }
              />
              <SummaryItem
                label="Fotografías"
                value={imageCount === 0 ? 'Ninguna' : `${imageCount} imagen(es)`}
              />
              <SummaryItem
                label="Patrón de consenso"
                value={
                  groundTruth === ''
                    ? 'Sin definir'
                    : (catalogs?.iga.labels[groundTruth] ?? groundTruth)
                }
              />
              <SummaryItem label="Registrado" value={date(new Date().toISOString())} />
            </dl>

            {imageCount === 0 ? (
              <Alert tone="warning" title="El caso no tiene fotografías">
                Puede cerrarlo igualmente y añadirlas después, pero sin imagen el caso no es
                revisable ni aporta al estudio.
              </Alert>
            ) : missingShots.length > 0 ? (
              <Alert tone="warning" title="Faltan tomas obligatorias">
                {listShotLabels(missingShots)}. El especialista podrá abrir el caso, pero no
                analizarlo ni registrar el diagnóstico hasta completarlas.
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => router.push(href(`/casos/${clinicalCase.id}`))}>
                Abrir la ficha para revisar
              </Button>
              <Button variant="ghost" onClick={() => router.push(href('/casos'))}>
                Ir a la bandeja
              </Button>
            </div>
            <p className="text-xs text-neutral-500">
              Abrir la ficha inicia el cronómetro de revisión (t₀) y revoca el código QR de este
              caso.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

/** The placeholder a section shows while the case it attaches to does not exist yet. */
function LockedNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-neutral-500">
      <Lock className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

function SummaryItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd
        className={cn(
          'text-sm text-neutral-900',
          mono === true && 'font-mono',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ageFrom(birthDate: string): number | null {
  if (birthDate === '') return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) age--;
  return age;
}
