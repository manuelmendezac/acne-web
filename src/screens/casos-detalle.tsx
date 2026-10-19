'use client';

import { ArrowLeft, Camera, CheckCircle2, ImageOff, Layers, RefreshCw, ScanFace } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AiAssessment } from '@/components/portal/ai-assessment';
import { AnamnesisMismatchAlert } from '@/components/portal/anamnesis-mismatch-alert';
import { AnalysisProgress } from '@/components/portal/analysis-progress';
import { CaseAnalysisMatrix } from '@/components/portal/case-analysis-matrix';
import { AnamnesisSummary } from '@/components/portal/anamnesis-summary';
import { CaseBranchActions } from '@/components/portal/case-branch-actions';
import {
  CaseHeader,
  CaseStats,
  VisitTimeline,
  type VisitEntry,
} from '@/components/portal/case-header';
import { DiagnosisForm } from '@/components/portal/diagnosis-form';
import { EnsembleVotes } from '@/components/portal/ensemble-votes';
import { PrescriptionPanel } from '@/components/portal/prescription-panel';
import { useSession } from '@/components/session-provider';
import { Badge, StudyModeBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert, ErrorState, Loading, StudyModeBlocked } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { describeNoAcne } from '@/lib/acne-verdict';
import { api, ApiError, type GetResult, type PostResult } from '@/lib/api';
import { date, num, pct } from '@/lib/format';
import { listShotLabels, shotLabel } from '@/lib/shots';
import { useAction, useApi } from '@/lib/use-api';
import { igaLabel, useCatalogs } from '@/lib/use-catalogs';
import { usePortalHref } from '@/lib/use-portal';

type CaseDetail = GetResult<'/cases/{id}'>;
type PatientHistory = GetResult<'/patients/{id}/history'>;
type CasePrescription = GetResult<'/prescriptions/case/{caseId}'>[number];
type Inference = PostResult<'/inference/case/{caseId}'>[number];
/**
 * Permiso → grupo de rol servido en `GET /meta/catalogs`.
 *
 * El catálogo expone los grupos ya calculados (`prescribing`, `delivery`, `diagnosing`) en vez de
 * la matriz completa, de modo que el portal pregunta por el grupo. Este mapa es el único sitio
 * donde los dos vocabularios se tocan.
 */
const PERMISSION_GROUPS: Record<string, string> = {
  diagnosticar: 'diagnosing',
  registrar_ingreso: 'intake',
  prescribir: 'prescribing',
  enviar_receta: 'delivery',
};

/** The API returns diagnoses as an untyped list on the detail; narrow it for rendering. */
type CaseDiagnosis = { id: string; igaClass: string; studyMode: string; createdAt: string };

/**
 * Case review screen.
 *
 * This is where the experiment actually happens, so two behaviours are load-bearing:
 *
 *  - **The chronometer is invisible.** Opening the case POSTs to `/cases/:id/open`, which stamps
 *    `t₀` server-side; submitting the diagnosis stamps `t₁`. Nothing counts down on screen: a
 *    visible timer would change how fast the physician works and bias the very measurement OE1
 *    is trying to capture.
 *  - **In pretest there is no trace of the AI.** No panel, no placeholder, no "hidden" section —
 *    and the server refuses the route anyway (RF-TR-01).
 */
export default function CasoDetallePage() {
  const href = usePortalHref();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const { data: catalogs } = useCatalogs();

  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  // Which Grad-CAM to show: null = the lead one (the heaviest model's); otherwise a member's.
  const [heatmapId, setHeatmapId] = useState<string | null>(null);

  const caseId = params.id;

  const open = useCallback(async () => {
    if (sessionLoading || user === null) return;

    setLoading(true);
    setError(null);
    try {
      // Only the dermatologist starts the measured review. The technician needs a read-only view
      // of the case and must not create a review timing entry.
      const result =
        user.role === 'tecnico'
          ? await api.getPath<CaseDetail>(`/cases/${caseId}`)
          : await api.post<CaseDetail>(`/cases/${caseId}/open`);
      setDetail(result);
      const clinical = result.images.find((image) => !image.isHeatmap);
      setSelectedImage(clinical?.id ?? null);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, caught instanceof Error ? caught.message : String(caught)),
      );
    } finally {
      setLoading(false);
    }
  }, [caseId, sessionLoading, user]);

  useEffect(() => {
    void open();
  }, [open]);

  const requestInference = useAction(async () =>
    api.post<Inference[]>(`/inference/case/${caseId}`),
  );

  const chooseReading = useAction(async (inferenceId: string, memberTag: string | null) => {
    await api.put(`/inference/case/${caseId}/selection`, { inferenceId, memberTag });
    await open();
  });
  const clearReading = useAction(async () => {
    await api.post(`/inference/case/${caseId}/selection/withdraw`);
    await open();
  });

  const closeCase = useAction(async () => api.post(`/cases/${caseId}/close`));
  // Junto a los demás hooks: debajo vive un retorno temprano, y llamarlo allí rompería el orden
  // de hooks entre renders.
  const resubmit = useAction(async () => api.post(`/cases/${caseId}/resubmit`, {}));

  /**
   * La historia del paciente y las recetas del caso.
   *
   * Van aparte y no bloquean la ficha: el especialista tiene que poder diagnosticar aunque la
   * historia tarde, y la evolución es contexto, no requisito. `null` mientras no se sepa el
   * paciente evita pedir una URL a medio construir.
   */
  const history = useApi<PatientHistory>(
    detail === null ? null : `/patients/${detail.patientId}/history`,
    /*
     * Se piden TODAS las visitas del paciente, sintéticas incluidas.
     *
     * El filtro de sintéticos existe para que los datos de demostración no contaminen indicadores
     * ni contrastes, no para recortar la historia de una persona: si el paciente tuvo esas visitas,
     * son suyas. Filtrarlas aquí mostraba un paciente con cuatro visitas como si tuviera una, que
     * es justo el contexto de evolución que esta sección existe para dar.
     */
    { includeSynthetic: true },
    [detail?.patientId],
  );
  const prescriptions = useApi<CasePrescription[]>(`/prescriptions/case/${caseId}`);

  /** Las visitas del paciente, de la más reciente a la más antigua. */
  const visits: VisitEntry[] = [...(history.data?.timeline ?? [])]
    .reverse()
    .map((entry) => ({
      caseId: entry.caseId,
      caseCode: entry.caseCode,
      createdAt: entry.createdAt,
      severityLabel: entry.severity === null ? null : igaLabel(catalogs, entry.severity),
      statusLabel: catalogs?.caseStatuses.labels[entry.status] ?? entry.status,
    }));

  // Tomas que el filtro del motor declaró sin acné. Aviso flotante una vez por resultado (aquí,
  // con los hooks: debajo hay retornos tempranos) y nota fija en la tarjeta de la IA.
  const noAcne =
    detail !== null && detail.aiVisible
      ? describeNoAcne(detail.caseAnalysis, catalogs?.shots?.definitions ?? [])
      : null;
  const { notify } = useToast();
  const notifiedNoAcne = useRef<string | null>(null);
  useEffect(() => {
    if (noAcne === null || notifiedNoAcne.current === noAcne.key) return;
    notifiedNoAcne.current = noAcne.key;
    notify({ tone: 'warning', title: noAcne.title, message: noAcne.message });
  }, [noAcne, notify]);

  if (loading) return <Loading label="Abriendo la ficha del caso…" />;
  if (error !== null) return <ErrorState message={error.message} onRetry={() => void open()} />;
  if (detail === null) return null;

  const clinicalImages = detail.images.filter((image) => !image.isHeatmap);
  const shotDefinitions = catalogs?.shots?.definitions ?? [];
  // The server's verdict on the protocol; names come from the catalogue for the banner.
  const missingShots = detail.missingShots.map((key) => ({
    key,
    label: shotLabel(shotDefinitions, key),
  }));
  const protocolBlockedReason =
    missingShots.length > 0
      ? `Faltan tomas obligatorias: ${listShotLabels(missingShots)}. Pida al mostrador que las complete.`
      : null;
  const members = detail.inference?.members ?? [];
  const caseSuggestion =
    detail.caseAnalysis !== null && detail.caseAnalysis.igaClass !== null
      ? detail.caseAnalysis
      : null;
  // Ninguna toma muestra acné: no hay clase que sugerir ni que marcar en el formulario.
  const noSuggestion = detail.caseAnalysis?.verdict === 'no_acne';
  const activeHeatmapId = heatmapId ?? detail.inference?.heatmapImageId ?? null;
  const heatmap = detail.images.find(
    (image) => image.isHeatmap && image.id === activeHeatmapId,
  );
  const allMembers = [
    ...members,
    ...(detail.caseAnalysis?.views ?? []).flatMap((view) => view.inference.members ?? []),
  ];
  const heatmapOwner = allMembers.find((member) => member.heatmapImageId === activeHeatmapId);
  const displayed =
    showHeatmap && heatmap !== undefined && detail.aiVisible
      ? heatmap
      : (clinicalImages.find((image) => image.id === selectedImage) ?? clinicalImages[0]);

  // Only a CNN produces a Grad-CAM: the map comes from the gradients of the convolutional layers.
  // When an external LLM answers, the overlay is the regions the model itself declared it looked
  // at — the model's own account, not a gradient attribution. Calling that Grad-CAM would be false,
  // and the physician reads this label as evidence of how the suggestion was formed.
  const isCnn = detail.inference?.modelBackend === 'torch';
  const overlayPhrase = isCnn
    ? 'el mapa de atención (Grad-CAM)'
    : 'las regiones señaladas por el análisis';
  const overlayAction = isCnn ? 'Ver mapa de atención' : 'Ver regiones';

  const diagnoses = detail.diagnoses as unknown as CaseDiagnosis[];
  // Toda medición del sistema es postest; el pretest lo transcribe el administrador desde el
  // registro manual de la clínica, así que aquí solo puede existir una por caso.
  const alreadyDiagnosed = diagnoses.some((diagnosis) => diagnosis.studyMode === 'postest');

  /**
   * Qué puede hacer quien mira la ficha, preguntado a los grupos de rol que sirve la API.
   *
   * Preguntar por el permiso y no por el rol es lo que evita que mover una capacidad entre roles
   * obligue a revisar cada pantalla: la matriz vive en `common/domain/roles.ts` y llega servida.
   */
  const can = (permission: string): boolean => {
    const groups = catalogs?.roles.groups;
    if (groups === undefined || user == null) return false;
    const key = PERMISSION_GROUPS[permission];
    return key === undefined ? false : (groups[key] ?? []).includes(user.role);
  };

  const canDiagnose = can('diagnosticar');

  // Devolver o derivar solo tiene sentido mientras el caso siga en la mesa del especialista.
  const canBranch =
    canDiagnose && ['en_revision', 'procesado_ia'].includes(detail.status);


  return (
    <div className="space-y-5">
      <Link
        href={href('/casos')}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a la bandeja
      </Link>

      <CaseHeader
        caseCode={detail.caseCode}
        statusLabel={catalogs?.caseStatuses.labels[detail.status] ?? detail.status}
        patientName={detail.patientName}
        patientCode={detail.patientCode}
        ageYears={history.data?.patient.ageYears ?? null}
        sexLabel={history.data?.patient.sex ?? null}
        phone={null}
        isSynthetic={detail.isSynthetic}
      />

      <CaseStats
        reviewMinutes={
          detail.timing?.durationMinutes == null
            ? null
            : `${num(detail.timing.durationMinutes)} min`
        }
        severityLabel={
          diagnoses.length === 0
            ? null
            : igaLabel(catalogs, diagnoses[diagnoses.length - 1]?.igaClass)
        }
        prescriptions={(prescriptions.data ?? []).length}
        images={detail.images.length}
      />

      {/*
        * El caso está esperando al mostrador. El aviso lleva el motivo escrito por el especialista
        * y, para quien opera la admisión, el botón que lo devuelve a la bandeja.
        */}
      {detail.status === 'solicitar_fotos' ? (
        <Alert tone="warning" title="El especialista pidió más fotografías">
          {detail.returnReason ?? 'No se registró el motivo.'}
          {can('registrar_ingreso') && canDiagnose ? (
            <div className="mt-3">
              <Button
                size="sm"
                loading={resubmit.pending}
                onClick={() => {
                  void resubmit.run().then((result) => {
                    if (result !== null) {
                      void open();
                      router.refresh();
                    }
                  });
                }}
              >
                <Camera className="h-4 w-4" aria-hidden />
                Ya subí las fotos, devolver a revisión
              </Button>
              {resubmit.error !== null ? (
                <p className="mt-2 text-xs text-red-700">{resubmit.error.message}</p>
              ) : null}
            </div>
          ) : null}
        </Alert>
      ) : null}

      {missingShots.length > 0 && detail.status !== 'cerrado' ? (
        <Alert tone="warning" title="El protocolo fotográfico está incompleto">
          Faltan las tomas obligatorias: {listShotLabels(missingShots)}. El caso se puede revisar,
          pero la inferencia y el diagnóstico quedan bloqueados hasta completarlas
          {canDiagnose ? ' — use «Solicitar fotos» para devolverlo al mostrador' : ''}.
        </Alert>
      ) : null}

      {detail.status === 'derivar_presencial' ? (
        <Alert tone="info" title="Caso derivado a atención presencial">
          {detail.returnReason ?? 'No se registró el motivo.'} La teleconsulta no alcanzó, de modo
          que este caso no aporta una medición de precisión diagnóstica.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Imagen clínica"
              description={
                detail.aiVisible && heatmap !== undefined
                  ? `Puede alternar entre la fotografía y ${overlayPhrase}.`
                  : 'Fotografía facial del caso.'
              }
              action={
                detail.aiVisible && heatmap !== undefined ? (
                  <Button
                    variant={showHeatmap ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setShowHeatmap((value) => !value)}
                  >
                    <Layers className="h-4 w-4" aria-hidden />
                    {showHeatmap ? 'Ver original' : overlayAction}
                  </Button>
                ) : null
              }
            />
            <CardBody>
              {displayed === undefined ? (
                <div className="flex flex-col items-center gap-2 py-12 text-neutral-500">
                  <ImageOff className="h-8 w-8" aria-hidden />
                  <p className="text-sm">Este caso todavía no tiene imágenes.</p>
                </div>
              ) : (
                <>
                  {/* Signed URL with a 15-minute TTL, served decrypted by the API (RNF-02). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={api.url(displayed.url.replace(/^\/api/, ''))}
                    alt={`Imagen clínica del caso ${detail.caseCode}`}
                    className="w-full rounded-md border border-neutral-200 bg-neutral-100 object-contain"
                  />
                  {displayed.isHeatmap && heatmapOwner !== undefined ? (
                    <p className="mt-2 text-xs text-neutral-500">
                      Mapa de atención de{' '}
                      <strong className="text-neutral-900">{heatmapOwner.tag}</strong>
                      {' · '}
                      {igaLabel(catalogs, heatmapOwner.igaClass)} ({pct(heatmapOwner.confidence * 100)})
                    </p>
                  ) : null}
                  {clinicalImages.length > 1 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {clinicalImages.map((image, index) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => {
                            setSelectedImage(image.id);
                            setShowHeatmap(false);
                          }}
                          className={
                            image.id === selectedImage
                              ? 'rounded-md border-2 border-purple-900 px-3 py-1 text-xs font-medium text-purple-900'
                              : 'rounded-md border border-neutral-200 px-3 py-1 text-xs text-neutral-500 hover:border-purple-900'
                          }
                        >
                          {index + 1}. {shotLabel(shotDefinitions, image.shotKey)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>

          {/* Placed BEFORE the AI panel and outside its visibility branch: the history is part of
              the clinical picture in both conditions, and showing it only alongside the model's
              suggestion would make HE₁ and HE₂ measure "anamnesis + IA" instead of the AI alone. */}
          <AnamnesisSummary caseId={detail.id} />

          <Card>
            <CardHeader
              title="Evaluación asistida"
              description="Sugerencia del sistema a partir de las fotografías y la anamnesis. No sustituye el juicio clínico."
            />
            <CardBody>
              {!detail.aiVisible ? (
                <StudyModeBlocked />
              ) : detail.inference === null ? (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-500">
                    Este caso aún no se ha analizado. Solicite el análisis para obtener la clase IGA
                    sugerida y las zonas en que se apoya.
                  </p>
                  {canDiagnose ? (
                    <>
                      {protocolBlockedReason !== null ? (
                        <Alert tone="warning">{protocolBlockedReason}</Alert>
                      ) : null}
                      <Button
                        loading={requestInference.pending}
                        disabled={clinicalImages.length === 0 || protocolBlockedReason !== null}
                        onClick={() => {
                          void requestInference.run().then(() => {
                            window.setTimeout(() => void open(), 2500);
                          });
                        }}
                      >
                        <ScanFace className="h-4 w-4" aria-hidden />
                        Analizar el caso
                      </Button>
                      {requestInference.error !== null ? (
                        requestInference.error.isStudyModeBlock ? (
                          <StudyModeBlocked />
                        ) : (
                          <Alert tone="danger">{requestInference.error.message}</Alert>
                        )
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      El análisis todavía no está disponible para este caso.
                    </p>
                  )}
                </div>
              ) : detail.inference.status === 'fallido' ? (
                <Alert tone="danger" title="El análisis falló">
                  {detail.inference.errorMessage ??
                    'El servicio de análisis no devolvió una lectura. Puede solicitarla de nuevo.'}
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => void open()}>
                    Actualizar
                  </Button>
                </Alert>
              ) : detail.inference.status !== 'exitoso' ? (
                <div className="space-y-3">
                  <AnalysisProgress status={detail.inference.status} />
                  <p className="text-xs text-neutral-500">
                    El análisis se procesa en segundo plano para que su duración no se sume al
                    tiempo de revisión médica.
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => void open()}>
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    Actualizar
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {noAcne !== null ? (
                    <Alert
                      tone="warning"
                      title={noSuggestion ? 'Sin sugerencia del sistema' : noAcne.title}
                    >
                      {noAcne.message}
                    </Alert>
                  ) : null}
                  {detail.caseAnalysis?.verdict === 'piel_sana' ? (
                    <Alert tone="info" title="Sugerencia del filtro de piel sana">
                      Ninguna toma muestra acné: la clase «Sin lesiones» la sugiere el filtro
                      previo, que reconoce la piel sana (pecas incluidas). Los modelos IGA no se
                      ejecutaron.
                    </Alert>
                  ) : null}
                  {noSuggestion ? null : (
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <p className="text-xs text-neutral-500">
                          {caseSuggestion !== null ? 'Clase IGA sugerida para el caso' : 'Clase IGA sugerida'}
                        </p>
                        <p className="text-2xl font-bold text-purple-900">
                          {igaLabel(catalogs, caseSuggestion?.igaClass ?? detail.inference.igaClass)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Confianza</p>
                        <p className="text-xl font-semibold tabular-nums text-neutral-900">
                          {(caseSuggestion?.confidence ?? detail.inference.confidence) === null
                            ? '—'
                            : pct((caseSuggestion?.confidence ?? detail.inference.confidence ?? 0) * 100)}
                        </p>
                      </div>
                      <div className="ml-auto text-right text-xs text-neutral-500">
                        <p>GAGS: {detail.inference.gagsScore ?? '—'}</p>
                        <p>{detail.inference.latencyMs ?? '—'} ms</p>
                      </div>
                    </div>
                  )}

                  {detail.inference.classProbs !== null ? (
                    <div className="space-y-1.5">
                      {Object.entries(detail.inference.classProbs)
                        .sort(([, a], [, b]) => b - a)
                        .map(([igaClass, probability]) => (
                          <div key={igaClass} className="flex items-center gap-2 text-xs">
                            <span className="w-36 shrink-0 text-neutral-500">
                              {igaLabel(catalogs, igaClass)}
                            </span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                              <div
                                className="h-full rounded-full bg-purple-900"
                                style={{ width: `${Math.round(probability * 100)}%` }}
                              />
                            </div>
                            <span className="w-12 text-right tabular-nums text-neutral-900">
                              {num(probability * 100, 1)}%
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : null}

                  {detail.caseAnalysis !== null && detail.caseAnalysis.completed > 0 ? (
                    <CaseAnalysisMatrix
                      analysis={detail.caseAnalysis}
                      catalogs={catalogs}
                      selectedHeatmap={showHeatmap ? activeHeatmapId : null}
                      onSelectHeatmap={(view, id) => {
                        setSelectedImage(view.imageId);
                        setHeatmapId(id);
                        setShowHeatmap(true);
                      }}
                      onChoose={(view, memberTag) =>
                        void chooseReading.run(view.inference.id, memberTag)
                      }
                      onClearChoice={() => void clearReading.run()}
                      choosing={chooseReading.pending || clearReading.pending}
                    />
                  ) : (
                    <EnsembleVotes
                      members={members}
                      agreement={detail.inference.agreement}
                      catalogs={catalogs}
                      recommended={detail.inference.igaClass}
                      selectedHeatmap={showHeatmap ? activeHeatmapId : null}
                      onSelectHeatmap={(id) => {
                        setHeatmapId(id);
                        setShowHeatmap(true);
                      }}
                    />
                  )}

                  <AnamnesisMismatchAlert messages={detail.anamnesisMismatch} />

                  {detail.caseAnalysis?.reading != null ? (
                    <AiAssessment assessment={detail.caseAnalysis.reading} title="Lectura del caso" />
                  ) : detail.inference.assessment !== null &&
                    detail.inference.assessment !== undefined ? (
                    <AiAssessment assessment={detail.inference.assessment} />
                  ) : null}

                  {detail.inference.modelBackend === 'stub' ? (
                    <Alert tone="warning" title="Backend de demostración">
                      El servicio de análisis opera en modo de demostración{' '}
                      <code>{detail.inference.modelVersion}</code>. Esta sugerencia{' '}
                      <strong>no proviene del clasificador entrenado</strong> y no puede citarse
                      como resultado.
                    </Alert>
                  ) : null}
                </div>
              )}
            </CardBody>
          </Card>

          {visits.length > 1 ? (
            <Card>
              <CardHeader
                title="Visitas del paciente"
                description="La evolución de su severidad, con esta visita marcada."
              />
              <CardBody>
                <VisitTimeline
                  visits={visits}
                  currentCaseId={detail.id}
                  onOpen={(id) => router.push(href(`/casos/${id}`))}
                  formatDate={date}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          {!canDiagnose ? (
            <Card>
              <CardHeader title="Consulta de solo lectura" />
              <CardBody>
                <p className="text-sm text-neutral-500">
                  Puede consultar la información del caso, pero el diagnóstico y las acciones
                  clínicas corresponden al dermatólogo.
                </p>
              </CardBody>
            </Card>
          ) : alreadyDiagnosed ? (
            <Card className="border-emerald-600/50">
              <CardBody className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                  Caso ya diagnosticado en esta condición
                </p>
                <p className="text-sm text-neutral-500">
                  Cada caso aporta una única medición por condición experimental. Para la otra
                  observación, cambie su modo de estudio.
                </p>
                {detail.timing?.durationMinutes != null ? (
                  <p className="text-sm text-neutral-500">
                    Tiempo de revisión registrado:{' '}
                    <strong className="text-neutral-900">
                      {num(detail.timing.durationMinutes)} min
                    </strong>
                  </p>
                ) : null}
                {detail.status === 'diagnosticado' ? (
                  <Button
                    variant="outline"
                    loading={closeCase.pending}
                    onClick={() => void closeCase.run().then(() => open())}
                  >
                    Cerrar caso
                  </Button>
                ) : null}
              </CardBody>
            </Card>
          ) : (
            <DiagnosisForm
              caseId={detail.id}
              aiSuggestion={
                // La clase del caso, como la que el servidor contrasta al firmar; nula cuando
                // ninguna toma mostró acné.
                detail.aiVisible && !noSuggestion
                  ? (caseSuggestion?.igaClass ?? detail.inference?.igaClass ?? null)
                  : null
              }
              blockedReason={protocolBlockedReason}
              mismatch={detail.anamnesisMismatch}
              onSubmitted={() => {
                void open();
                router.refresh();
              }}
            />
          )}

          {/*
            * Las dos salidas que no son diagnosticar. Van DESPUÉS del formulario porque el camino
            * normal es juzgar: ponerlas antes invitaría a devolver un caso que solo necesitaba
            * mirarse con calma, y cada devolución cuesta una visita más al paciente.
            */}
          {canBranch ? (
            <CaseBranchActions
              caseId={detail.id}
              status={detail.status}
              onChanged={() => {
                void open();
                router.refresh();
              }}
            />
          ) : null}

          <PrescriptionPanel
            caseId={detail.id}
            hasDiagnosis={diagnoses.length > 0}
            canPrescribe={canDiagnose && can('prescribir')}
            canSend={canDiagnose && can('enviar_receta')}
          />

          <Card>
            <CardHeader title="Mediciones registradas" />
            <CardBody className="space-y-2 text-sm">
              {diagnoses.length === 0 ? (
                <p className="text-neutral-500">Sin diagnósticos todavía.</p>
              ) : (
                diagnoses.map((diagnosis) => (
                  <div
                    key={diagnosis.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2"
                  >
                    <StudyModeBadge mode={diagnosis.studyMode} />
                    <span className="text-neutral-900">
                      {igaLabel(catalogs, diagnosis.igaClass)}
                    </span>
                  </div>
                ))
              )}
              {detail.groundTruthIga !== null ? (
                <p className="pt-2 text-xs text-neutral-500">
                  Patrón de consenso del lote:{' '}
                  <strong className="text-neutral-900">
                    {igaLabel(catalogs, detail.groundTruthIga)}
                  </strong>{' '}
                  — es lo que hace comparables pretest y postest (RF-OE2-05).
                </p>
              ) : (
                <p className="pt-2 text-xs text-amber-600">
                  Este caso no tiene patrón de consenso, por lo que no aporta al cálculo de TPD.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
