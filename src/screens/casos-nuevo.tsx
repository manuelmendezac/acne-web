'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { AnamnesisForm, type AnamnesisAnswers } from '@/components/portal/anamnesis-form';
import { AnalysisPanel } from '@/components/portal/analysis-panel';
import { CaseAdminActions } from '@/components/portal/case-admin-actions';
import { CaptureQrPanel, type CaseImage } from '@/components/portal/capture-qr-panel';
import { PageHeader } from '@/components/portal/page-header';
import { PatientFields } from '@/components/portal/patient-fields';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardBody } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, ErrorState, Loading } from '@/components/ui/feedback';
import { api, ApiError, type GetResult, type PostResult } from '@/lib/api';
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
type SavedAnamnesis = GetResult<'/cases/{caseId}/anamnesis'>;

/** The query parameter that carries the case being filled, so a reload resumes it. */
const RESUME_PARAM = 'caso';
/** Statuses in which the case is still the desk's to fill. */
const INTAKE_STATUSES = ['borrador', 'solicitar_fotos'];

type StepState = 'done' | 'current' | 'pending' | 'locked';
type PatientMode = 'nuevo' | 'registrado';

/**
 * Case intake, on a single screen.
 *
 * Everything administrative — registering the patient, taking the history, collecting the
 * photographs — happens HERE, before the case file is ever opened for review. The chronometer that
 * OE1 reports as review time starts at `POST /cases/:id/open` (RF-OE1-01), so nothing typed on this
 * page can inflate the TRM the thesis measures. Putting the questionnaire on the case screen
 * instead would have quietly added a minute of typing to every observation in both conditions.
 *
 * The steps are all visible from the first render, with a rail on the left that says which are
 * done, so whoever is at the desk sees the whole shape of the intake at once. The later ones stay
 * locked until the case exists, and that is a real dependency rather than a pacing device: the
 * anamnesis and the photographs both attach to a case id, so there is nothing to attach them to
 * until the first step has been submitted. The case starts as `draft` and only enters the tray once
 * it has content.
 *
 * The case exists on the server from the first step on, so the page must be able to pick it up
 * again: its id goes into the address (`?caso=<id>`) the moment it is created, and opening that
 * address — after a reload, or from «Continuar ingreso» in the tray — restores the patient, the saved
 * anamnesis, the photographs and the analysis. Until 25/10/2026 everything lived only in memory and
 * a reload left a half-filled case that nobody could finish.
 */
export default function NuevoCasoPage() {
  const href = usePortalHref();
  const router = useRouter();
  const pathname = usePathname();
  const {
    data: catalogs,
    error: catalogsError,
    loading: catalogsLoading,
    reload: reloadCatalogs,
  } = useCatalogs();

  // --- Patient ---------------------------------------------------------------
  const [mode, setMode] = useState<PatientMode>('nuevo');
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
  // Kept as the record itself, not an id looked up in the results: typing a new search must not
  // silently drop the chosen patient — with the old derived lookup, an empty match meant
  // "register a new one" and the case went to a duplicate.
  const [selectedExisting, setSelectedExisting] = useState<Patient | null>(null);
  const debouncedPatientSearch = useDebouncedValue(patientSearch.trim(), 200);
  const existing = useApi<Patient[]>(mode === 'registrado' ? '/patients' : null, {
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

  const startCase = useAction(async () => {
    let target = mode === 'registrado' ? selectedExisting : null;

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
    // From here on the case is real: put it in the address so a reload comes back to it.
    router.replace(`${pathname}?${RESUME_PARAM}=${created.id}`, { scroll: false });
    return created;
  });

  // --- Resuming a case already created ----------------------------------------
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const resume = async (caseId: string): Promise<void> => {
    setResuming(true);
    setResumeError(null);
    try {
      const found = await api.getPath<CaseSummary>(`/cases/${caseId}`);
      const owner = await api.getPath<Patient>(`/patients/${found.patientId}`);
      let saved: SavedAnamnesis | null = null;
      try {
        saved = await api.getPath<SavedAnamnesis>(`/cases/${caseId}/anamnesis`);
      } catch (error: unknown) {
        // 404 is the normal answer while no anamnesis has been saved yet.
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
      const previous = await api.getPath<AnamnesisPrefill>(
        `/patients/${owner.id}/anamnesis/latest`,
        { excludeCaseId: caseId },
      );

      setPatient(owner);
      setClinicalCase(found);
      setGroundTruth(found.groundTruthIga ?? '');
      setPrefill(previous);
      if (saved !== null) {
        setAnswers(saved.answers as AnamnesisAnswers);
        setAnamnesisSaved(true);
      }
    } catch (error: unknown) {
      setResumeError(
        error instanceof ApiError ? error.message : 'No se pudo recuperar el caso.',
      );
    } finally {
      setResuming(false);
    }
  };

  useEffect(() => {
    // Read once, on arrival: the address is written by this page itself after creating the case.
    const caseId = new URLSearchParams(window.location.search).get(RESUME_PARAM);
    if (caseId !== null && caseId !== '') void resume(caseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const photosComplete = imageCount > 0 && missingShots.length === 0;
  const canStart =
    mode === 'registrado' ? selectedExisting !== null : fullName.trim() !== '' && consent;

  const patientLabel = patient?.fullName ?? patient?.patientCode ?? null;
  const steps: Array<{ id: string; label: string; detail: string; state: StepState }> = [
    {
      id: 'paso-paciente',
      label: 'Paciente',
      detail: created ? (patientLabel ?? 'Registrado') : 'Alta o búsqueda',
      state: created ? 'done' : 'current',
    },
    {
      id: 'paso-anamnesis',
      label: 'Anamnesis',
      detail: anamnesisSaved ? `${answeredCount} de ${applicable} respuestas` : 'Cuestionario de ingreso',
      state: !created ? 'locked' : anamnesisSaved ? 'done' : 'current',
    },
    {
      id: 'paso-fotografias',
      label: 'Fotografías',
      detail:
        imageCount === 0
          ? 'Protocolo de tres tomas'
          : photosComplete
            ? `${imageCount} toma(s), completo`
            : `${imageCount} toma(s), incompleto`,
      state: !created ? 'locked' : photosComplete ? 'done' : anamnesisSaved ? 'current' : 'pending',
    },
    {
      id: 'paso-analisis',
      label: 'Análisis',
      detail: 'Evaluación asistida',
      state: !created ? 'locked' : 'pending',
    },
    {
      id: 'paso-cierre',
      label: 'Cierre',
      detail: 'Enviar a revisión',
      state: !created ? 'locked' : 'pending',
    },
  ];
  const doneCount = steps.filter((step) => step.state === 'done').length;

  if (resuming) return <Loading label="Recuperando el caso…" />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Ingreso de paciente"
        title={created ? `Caso ${clinicalCase.caseCode}` : 'Nuevo caso'}
        description="Registre al paciente, su anamnesis y las fotografías antes de pasar el caso a revisión. Nada de lo que se haga aquí cuenta como tiempo de consulta."
        actions={
          <Link href={href('/casos')} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Volver a la bandeja
          </Link>
        }
      />

      {resumeError !== null ? (
        <Alert tone="danger" title="No se pudo recuperar el caso">
          <p>{resumeError}</p>
          <p className="mt-2">
            Búsquelo en la bandeja y use «Continuar ingreso», o registre uno nuevo en este
            formulario.
          </p>
        </Alert>
      ) : null}

      {created && clinicalCase.voidedAt !== null ? (
        <Alert tone="danger" title="Este caso está anulado">
          {clinicalCase.voidReason ?? 'Sin motivo registrado.'} Ya no admite fotografías, respuestas
          ni análisis.
        </Alert>
      ) : created && !INTAKE_STATUSES.includes(clinicalCase.status) ? (
        <Alert tone="warning" title="Este caso ya pasó a revisión">
          El especialista ya abrió la ficha. Las fotografías o respuestas que agregue ahora no
          formarán parte de lo que revisó.{' '}
          <Link href={href(`/casos/${clinicalCase.id}`)} className="font-medium underline">
            Ir a la ficha
          </Link>
        </Alert>
      ) : null}

      {/* Progress on small screens, where the rail does not fit. */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>
            {doneCount} de {steps.length} pasos completos
          </span>
          <span className="font-medium text-neutral-900">
            {steps.find((step) => step.state === 'current')?.label ?? ''}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1">
          {steps.map((step) => (
            <span
              key={step.id}
              className={cn(
                'h-1 rounded-full',
                step.state === 'done'
                  ? 'bg-purple-900'
                  : step.state === 'current'
                    ? 'bg-purple-300'
                    : 'bg-neutral-200',
              )}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
        <StepRail steps={steps} />

        <div className="min-w-0 space-y-6">
          {/* --- 1. Paciente ------------------------------------------------- */}
          <Section
            id="paso-paciente"
            number={1}
            state={created ? 'done' : 'current'}
            title="Paciente"
            description={
              created
                ? 'Los datos del paciente se corrigen desde su ficha.'
                : 'Busque a un paciente que ya se atendió en el centro o registre uno nuevo.'
            }
          >
            {created ? (
              <div className="flex flex-wrap items-center gap-4 px-6 py-5">
                <Initials name={patientLabel ?? '—'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {patientLabel ?? '—'}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {patient?.patientCode}
                    {ageYears !== null ? ` · ${ageYears} años` : ''}
                    {patientSex !== null ? ` · ${patientSex}` : ''}
                  </p>
                </div>
                <dl className="flex gap-6 text-sm">
                  <div>
                    <dt className="text-xs text-neutral-500">Caso</dt>
                    <dd className="font-mono font-medium text-neutral-900">
                      {clinicalCase.caseCode}
                    </dd>
                  </div>
                  {groundTruth !== '' ? (
                    <div>
                      <dt className="text-xs text-neutral-500">Patrón de consenso</dt>
                      <dd className="font-medium text-neutral-900">
                        {catalogs?.iga.labels[groundTruth] ?? groundTruth}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : (
              <>
                <div className="space-y-6 px-6 py-5">
                  <ModeSwitch
                    value={mode}
                    onChange={(next) => {
                      setMode(next);
                      if (next === 'nuevo') setSelectedExisting(null);
                    }}
                  />

                  {mode === 'registrado' ? (
                    <PatientPicker
                      search={patientSearch}
                      onSearch={setPatientSearch}
                      results={existing.data ?? []}
                      loading={existing.loading}
                      selected={selectedExisting}
                      onSelect={setSelectedExisting}
                    />
                  ) : (
                    <div className="space-y-6">
                      <FormGroup
                        title="Datos del paciente"
                        description="El nombre, el documento y el contacto se guardan cifrados."
                      >
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
                      </FormGroup>

                      <label
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                          consent
                            ? 'border-purple-900/30 bg-purple-50/60'
                            : 'border-neutral-200 hover:border-neutral-300',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(event) => setConsent(event.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-300 accent-purple-900"
                        />
                        <span className="text-sm">
                          <span className="flex items-center gap-1.5 font-medium text-neutral-900">
                            <ShieldCheck className="h-4 w-4 text-purple-900" aria-hidden />
                            Consentimiento informado
                            <span className="text-red-700">*</span>
                          </span>
                          <span className="mt-1 block text-neutral-500">
                            El paciente autoriza el uso de sus fotografías con fines de
                            investigación académica, conforme a la Ley N.º 29733 de protección de
                            datos personales.
                          </span>
                        </span>
                      </label>
                    </div>
                  )}

                  <FormGroup
                    title="Datos del estudio"
                    description="Etiqueta de referencia del lote; permite comparar las fases del estudio. Puede dejarse sin definir."
                  >
                    <Field label="Patrón de consenso IGA" className="sm:max-w-xs">
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
                  </FormGroup>

                  {startCase.error !== null ? (
                    <Alert tone="danger" title="No se pudo crear el caso">
                      {startCase.error.message}
                    </Alert>
                  ) : null}
                </div>

                <SectionFooter
                  note="Crear el caso no abre la ficha de revisión."
                  action={
                    <Button
                      loading={startCase.pending}
                      disabled={!canStart}
                      onClick={() => void startCase.run()}
                    >
                      Crear caso
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                  }
                />
              </>
            )}
          </Section>

          {/* --- 2. Anamnesis ------------------------------------------------ */}
          <Section
            id="paso-anamnesis"
            number={2}
            state={!created ? 'locked' : anamnesisSaved ? 'done' : 'current'}
            title="Anamnesis"
            description="Cuestionario de ingreso. Se registra igual en todas las fases del estudio."
            aside={
              created && anamnesisSaved ? (
                <Badge variant="success">
                  <Check className="mr-1 h-3 w-3" aria-hidden />
                  Guardada · {answeredCount} de {applicable}
                </Badge>
              ) : null
            }
          >
            {!created ? (
              <LockedNote>Disponible al crear el caso.</LockedNote>
            ) : catalogs === null ? (
              <div className="px-6 py-5">
                {/* The questionnaire is served by the API. Without it the form has nothing to
                    render, and "0 de 0 preguntas" said nothing about why. */}
                {catalogsLoading ? (
                  <Loading label="Cargando el cuestionario…" />
                ) : (
                  <ErrorState
                    message={`No se pudo cargar el cuestionario de anamnesis${
                      catalogsError !== null ? `: ${catalogsError.message}` : ''
                    }. Compruebe que la API esté disponible y reintente.`}
                    onRetry={reloadCatalogs}
                  />
                )}
              </div>
            ) : (
              <>
                <div className="space-y-4 px-6 py-5">
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
                </div>

                <SectionFooter
                  note={
                    anamnesisSaved
                      ? 'Guardada. Puede corregir respuestas y volver a guardar.'
                      : 'Ninguna pregunta es obligatoria.'
                  }
                  action={
                    <Button
                      variant={anamnesisSaved ? 'outline' : undefined}
                      loading={saveAnamnesis.pending}
                      onClick={() => void saveAnamnesis.run(true)}
                    >
                      {anamnesisSaved ? 'Guardar cambios' : 'Guardar anamnesis'}
                    </Button>
                  }
                />
              </>
            )}
          </Section>

          {/* --- 3. Fotografías ---------------------------------------------- */}
          <Section
            id="paso-fotografias"
            number={3}
            state={!created ? 'locked' : photosComplete ? 'done' : anamnesisSaved ? 'current' : 'pending'}
            title="Fotografías clínicas"
            description="Vista general y ambos perfiles, desde el teléfono con un código QR o desde este equipo."
            aside={
              created && photosComplete ? (
                <Badge variant="success">
                  <Check className="mr-1 h-3 w-3" aria-hidden />
                  Protocolo completo
                </Badge>
              ) : null
            }
          >
            {created ? (
              <CaptureQrPanel
                caseId={clinicalCase.id}
                caseCode={clinicalCase.caseCode}
                onImagesChanged={setImages}
                embedded
              />
            ) : (
              <LockedNote>Disponible al crear el caso.</LockedNote>
            )}
          </Section>

          {/* --- 4. Análisis -------------------------------------------------
              Después de las fotografías y antes del cierre, que es el orden real del ingreso: se
              fotografía, se analiza, y recién entonces se decide si el caso se manda a revisión. */}
          {created ? (
            <div id="paso-analisis" className="scroll-mt-20">
              <AnalysisPanel
                caseId={clinicalCase.id}
                imageCount={imageCount}
                missingShots={missingShots}
                anamnesisReady={anamnesisSaved}
              />
            </div>
          ) : (
            <Section
              id="paso-analisis"
              number={4}
              state="locked"
              title="Análisis"
              description="Evaluación asistida de las tomas, cuando el protocolo esté completo."
            >
              <LockedNote>Disponible al completar las fotografías.</LockedNote>
            </Section>
          )}

          {/* --- 5. Cierre --------------------------------------------------- */}
          <Section
            id="paso-cierre"
            number={5}
            state={created ? 'pending' : 'locked'}
            title="Terminar el ingreso"
            description="Revise el resumen y envíe el caso a la consulta."
          >
            {!created ? (
              <LockedNote>Disponible al crear el caso.</LockedNote>
            ) : (
              <>
                <div className="space-y-4 px-6 py-5">
                  <dl className="grid overflow-hidden rounded-lg border border-neutral-200 sm:grid-cols-3">
                    <SummaryItem label="Caso" value={clinicalCase.caseCode} mono />
                    <SummaryItem
                      label="Paciente"
                      value={`${patientLabel ?? '—'} (${patient?.patientCode ?? '—'})`}
                    />
                    <SummaryItem label="Registrado" value={date(clinicalCase.createdAt)} />
                    <SummaryItem
                      label="Anamnesis"
                      value={
                        anamnesisSaved
                          ? `${answeredCount} de ${applicable} preguntas`
                          : 'Sin registrar'
                      }
                      tone={anamnesisSaved ? 'ok' : 'warn'}
                    />
                    <SummaryItem
                      label="Fotografías"
                      value={imageCount === 0 ? 'Ninguna' : `${imageCount} imagen(es)`}
                      tone={photosComplete ? 'ok' : 'warn'}
                    />
                    <SummaryItem
                      label="Patrón de consenso"
                      value={
                        groundTruth === ''
                          ? 'Sin definir'
                          : (catalogs?.iga.labels[groundTruth] ?? groundTruth)
                      }
                    />
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
                </div>

                <SectionFooter
                  note="Abrir la ficha inicia el tiempo de revisión y revoca el código QR de este caso."
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" onClick={() => router.push(href('/casos'))}>
                        Ir a la bandeja
                      </Button>
                      <Button onClick={() => router.push(href(`/casos/${clinicalCase.id}`))}>
                        Abrir la ficha para revisar
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  }
                />
              </>
            )}
          </Section>

          {created ? (
            <CaseAdminActions
              caseId={clinicalCase.id}
              // The patient may have changed: re-read the case as a resume would.
              onChanged={() => void resume(clinicalCase.id)}
              onRemoved={() => router.push(href('/casos'))}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// --- Layout pieces -------------------------------------------------------------

/** The left rail: every step of the intake, with the ones done marked and each one a link. */
function StepRail({
  steps,
}: {
  steps: Array<{ id: string; label: string; detail: string; state: StepState }>;
}) {
  return (
    <nav aria-label="Pasos del ingreso" className="hidden lg:block">
      <ol className="sticky top-20">
        {steps.map((step, index) => (
          <li key={step.id} className="relative pb-6 last:pb-0">
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  'absolute left-3.5 top-8 -ml-px h-[calc(100%-2rem)] w-0.5',
                  step.state === 'done' ? 'bg-purple-900' : 'bg-neutral-200',
                )}
              />
            ) : null}
            <a
              href={`#${step.id}`}
              aria-current={step.state === 'current' ? 'step' : undefined}
              className="group flex items-start gap-3"
            >
              <StepDot number={index + 1} state={step.state} />
              <span className="min-w-0 pt-1">
                <span
                  className={cn(
                    'block text-sm font-medium',
                    step.state === 'locked'
                      ? 'text-neutral-400'
                      : 'text-neutral-900 group-hover:text-purple-900',
                  )}
                >
                  {step.label}
                </span>
                <span className="block truncate text-xs text-neutral-500">{step.detail}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function StepDot({ number, state }: { number: number; state: StepState }) {
  return (
    <span
      className={cn(
        'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        state === 'done' && 'bg-purple-900 text-white',
        state === 'current' && 'bg-white text-purple-900 ring-2 ring-purple-900',
        state === 'pending' && 'bg-white text-neutral-600 ring-1 ring-neutral-300',
        state === 'locked' && 'bg-neutral-100 text-neutral-400',
      )}
    >
      {state === 'done' ? <Check className="h-3.5 w-3.5" aria-hidden /> : number}
    </span>
  );
}

/** One step of the intake: a card whose header carries the step number and its state. */
function Section({
  id,
  number,
  state,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  number: number;
  state: StepState;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-20">
      <Card className={cn(state === 'current' && 'ring-1 ring-purple-900/10')}>
        <header className="flex flex-wrap items-start gap-4 border-b border-neutral-200 px-6 py-4">
          <StepDot number={number} state={state} />
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-titulo`} className="text-base font-semibold text-neutral-900">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
          </div>
          {aside !== undefined && aside !== null ? <div className="shrink-0">{aside}</div> : null}
        </header>
        {children}
      </Card>
    </section>
  );
}

function SectionFooter({ note, action }: { note: string; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-neutral-200 bg-neutral-50 px-6 py-3">
      <p className="text-xs text-neutral-500">{note}</p>
      {action}
    </div>
  );
}

/** A titled group of fields inside a step, set off by a hairline instead of another card. */
function FormGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-4 border-t border-neutral-200 pt-5 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden>
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        {description !== undefined ? (
          <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
        ) : null}
      </div>
      {children}
    </fieldset>
  );
}

/** The placeholder a step shows while what it attaches to does not exist yet. */
function LockedNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 px-6 py-4 text-sm text-neutral-400">
      <Lock className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

// --- Patient step --------------------------------------------------------------

function ModeSwitch({
  value,
  onChange,
}: {
  value: PatientMode;
  onChange: (value: PatientMode) => void;
}) {
  const options: Array<{ value: PatientMode; label: string; icon: ReactNode }> = [
    { value: 'nuevo', label: 'Paciente nuevo', icon: <UserPlus className="h-4 w-4" aria-hidden /> },
    {
      value: 'registrado',
      label: 'Paciente registrado',
      icon: <Users className="h-4 w-4" aria-hidden />,
    },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Tipo de paciente"
      className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              selected
                ? 'bg-white text-purple-900 shadow-xs ring-1 ring-neutral-200'
                : 'text-neutral-500 hover:text-neutral-900',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Search-as-you-type over the patients already registered.
 *
 * The matches drop down under the box, like an address bar, and the one chosen replaces the box
 * with a card: a list that is always open took the room of the whole form, and the `<select>` it
 * replaced needed a second click to show anything at all.
 */
function PatientPicker({
  search,
  onSearch,
  results: fetched,
  loading,
  selected,
  onSelect,
}: {
  search: string;
  onSearch: (value: string) => void;
  results: Patient[];
  loading: boolean;
  selected: Patient | null;
  onSelect: (patient: Patient | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const query = search.trim();
  const showList = open && query !== '';
  // The server filters, but its answer arrives after the debounce and the round trip; meanwhile
  // the list on screen would be the previous query's. Filtering here too, with the same rule the
  // API uses (no case, no accents), makes the first keystroke narrow the list at once and keeps a
  // stale answer from ever showing patients that do not match what is typed.
  const needle = normalizeForSearch(query);
  const matches = fetched.filter(
    (p) =>
      normalizeForSearch(p.fullName ?? '').includes(needle) ||
      normalizeForSearch(p.patientCode).includes(needle),
  );
  const safeActive = Math.min(active, Math.max(matches.length - 1, 0));

  const choose = (patient: Patient): void => {
    onSelect(patient);
    onSearch('');
    setOpen(false);
  };

  if (selected !== null) {
    const name = selected.fullName ?? selected.patientCode;
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-purple-900/30 bg-purple-50/60 p-4">
        <Initials name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
          <p className="text-sm text-neutral-500">
            {selected.patientCode}
            {selected.ageYears !== null && selected.ageYears !== undefined
              ? ` · ${selected.ageYears} años`
              : ''}
            {selected.sex !== null && selected.sex !== undefined ? ` · ${selected.sex}` : ''}
            {' · '}
            {selected.caseCount === 0 ? 'sin visitas previas' : `${selected.caseCount} visita(s)`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onSelect(null);
            // The box comes back; put the cursor in it so the next search is one keystroke away.
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <Input
          ref={inputRef}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && matches.length > 0 ? `${listId}-${safeActive}` : undefined
          }
          value={search}
          onChange={(event) => {
            onSearch(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          // The list is dismissed on blur, but a click on an option fires blur first; the options
          // cancel the mousedown so the input keeps focus and the click lands.
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (!showList) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((i) => Math.min(i + 1, matches.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const patient = matches[safeActive];
              if (patient !== undefined) choose(patient);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder="Escriba el nombre o el código del paciente…"
          className="pl-9"
          aria-label="Buscar paciente"
          autoComplete="off"
          autoFocus
        />

        {showList ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Pacientes encontrados"
            className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
          >
            {loading ? (
              <li className="flex items-center gap-2 px-4 py-1.5 text-xs text-neutral-400">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Buscando…
              </li>
            ) : null}
            {matches.length === 0 ? (
              loading ? null : (
                <li className="px-4 py-3 text-sm text-neutral-500">
                  Ningún paciente coincide con «{query}». Cambie a «Paciente nuevo» para
                  registrarlo.
                </li>
              )
            ) : (
              matches.map((p, index) => {
                const name = p.fullName ?? p.patientCode;
                const isActive = index === safeActive;
                return (
                  <li
                    key={p.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={isActive}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(p)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-3 py-2.5',
                      isActive && 'bg-purple-50',
                    )}
                  >
                    <Initials name={name} small />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-900">
                        {name}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {p.patientCode}
                        {p.ageYears !== null && p.ageYears !== undefined
                          ? ` · ${p.ageYears} años`
                          : ''}
                        {p.sex !== null && p.sex !== undefined ? ` · ${p.sex}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {p.caseCount === 0 ? 'Sin visitas' : `${p.caseCount} visita(s)`}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>

      <p className="text-xs text-neutral-500">
        Elija al paciente de la lista. Si no aparece, cambie a «Paciente nuevo» para registrarlo.
      </p>
    </div>
  );
}

function Initials({ name, small }: { name: string; small?: boolean }) {
  const letters = name
    .split(/\s+/)
    .filter((part) => part !== '')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-purple-50 font-semibold text-purple-900',
        small === true ? 'h-8 w-8 text-xs' : 'h-11 w-11 text-sm',
      )}
    >
      {letters === '' ? <UserRound className="h-4 w-4" /> : letters}
    </span>
  );
}

// --- Summary -------------------------------------------------------------------

function SummaryItem({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div className="border-b border-neutral-200 px-4 py-3 last:border-b-0 sm:nth-[n+4]:border-b-0 sm:not-nth-[3n]:border-r">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 flex items-center gap-1.5 text-sm font-medium text-neutral-900',
          mono === true && 'font-mono',
        )}
      >
        {tone !== undefined ? (
          <span
            aria-hidden
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              tone === 'ok' ? 'bg-emerald-500' : 'bg-amber-500',
            )}
          />
        ) : null}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}

/** Lower-case and without diacritics: the rule the API applies to the same search. */
function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
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
