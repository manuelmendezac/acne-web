'use client';

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ScanFace } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { AiAssessment } from '@/components/portal/ai-assessment';
import { AnamnesisMismatchAlert } from '@/components/portal/anamnesis-mismatch-alert';
import { AnalysisProgress } from '@/components/portal/analysis-progress';
import { CaseAnalysisMatrix } from '@/components/portal/case-analysis-matrix';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { describeNoAcne } from '@/lib/acne-verdict';
import { api, type GetResult, type PostResult } from '@/lib/api';
import { num, pct } from '@/lib/format';
import { listShotLabels, type ShotDefinitionLike } from '@/lib/shots';
import { useAction, useApi, usePolledApi } from '@/lib/use-api';
import { igaLabel, useCatalogs } from '@/lib/use-catalogs';

type Inference = PostResult<'/inference/case/{caseId}'>[number];
type CaseAnalysis = GetResult<'/inference/case/{caseId}/analysis'>;
type CaseDetail = GetResult<'/cases/{id}'>;

/**
 * El análisis del caso: la fotografía y la anamnesis leídas juntas.
 *
 * Aparece en el ingreso, cuando ya hay algo que analizar, y no antes: pedirle al modelo que mire
 * un caso sin fotografía es pedirle que invente.
 *
 * **Por qué exige la anamnesis guardada.** El contexto clínico se lee en el momento en que el
 * trabajo sale de la cola, no cuando se encola, y lo que llega al modelo son las respuestas ya
 * archivadas. Analizar con el cuestionario a medio llenar produce una lectura hecha solo con
 * píxeles que después nadie distingue de una completa — de ahí que el botón espere y lo diga.
 *
 * **Por qué se sondea.** La inferencia es asíncrona a propósito: si el médico esperase al modelo,
 * la latencia del motor se sumaría al tiempo de revisión que mide OE1 y estaría midiendo otra
 * cosa. Aquí, en el ingreso, no hay cronómetro corriendo, así que se puede mostrar el avance sin
 * contaminar ninguna medición.
 */
export function AnalysisPanel({
  caseId,
  imageCount,
  missingShots,
  anamnesisReady,
}: {
  caseId: string;
  imageCount: number;
  /** Required shots still missing; the server refuses the analysis while there are any. */
  missingShots: readonly ShotDefinitionLike[];
  anamnesisReady: boolean;
}): JSX.Element {
  const { data: catalogs } = useCatalogs();
  const [started, setStarted] = useState(false);

  /**
   * El análisis del caso: una inferencia por toma obligatoria, combinadas por el servidor.
   *
   * Se sondea solo mientras hay algo que esperar. Un intervalo permanente convertiría una pantalla
   * abierta y olvidada en una consulta cada dos segundos contra la base, toda la tarde. Se recarga
   * también cuando cambia el recuento de fotografías, por si una toma nueva invalida la lectura.
   */
  const analysis = usePolledApi<CaseAnalysis>(
    `/inference/case/${caseId}/analysis`,
    undefined,
    started ? 2000 : 0,
  );
  const current = analysis.data ?? null;
  const hasViews = current !== null && current.views.length > 0;
  const running = hasViews && current.pending > 0;
  const done = hasViews && current.completed > 0 && current.pending === 0;
  const failed = hasViews && current.pending === 0 && current.completed === 0 && current.failed > 0;
  const latest = hasViews ? current.views[current.views.length - 1]?.inference ?? null : null;

  // Al llegar el resultado se corta el sondeo; dejarlo vivo no añade nada.
  useEffect(() => {
    if (started && hasViews && !running) setStarted(false);
  }, [started, hasViews, running]);
  useEffect(() => {
    analysis.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageCount]);

  const analyse = useAction(async () => {
    // Las tres tomas obligatorias, con la última fotografía de cada una: IGA gradúa la cara
    // completa, no una mejilla.
    const result = await api.post<Inference[]>(`/inference/case/${caseId}`);
    setStarted(true);
    return result;
  });
  // Una lectura nueva de cada toma aunque ya exista una: para cuando cambió el modelo servido o
  // el especialista quiere una segunda pasada. Las anteriores quedan en el historial.
  const reanalyse = useAction(async () => {
    const result = await api.post<Inference[]>(`/inference/case/${caseId}?force=true`);
    setStarted(true);
    await analysis.reload();
    return result;
  });

  // Quien mira las fotos decide qué lectura vale: una toma y, si quiere, un modelo. El servidor
  // la guarda y la aplica; aquí solo se recargan el análisis y la ficha (la incongruencia depende
  // de la clase elegida).
  const choose = useAction(async (inferenceId: string, memberTag: string | null) => {
    await api.put(`/inference/case/${caseId}/selection`, { inferenceId, memberTag });
    analysis.reload();
  });
  const clearChoice = useAction(async () => {
    await api.post(`/inference/case/${caseId}/selection/withdraw`);
    analysis.reload();
  });

  const protocolIncomplete = missingShots.length > 0;

  // Las tomas que el filtro del motor declaró sin acné: aviso flotante una vez por resultado, y
  // nota fija en el panel, porque el aviso se cierra solo y quien vuelva al caso tiene que saber
  // por qué no hay sugerencia.
  const noAcne = done ? describeNoAcne(current, catalogs?.shots.definitions ?? []) : null;
  const { notify } = useToast();
  const notified = useRef<string | null>(null);
  useEffect(() => {
    if (noAcne === null || notified.current === noAcne.key) return;
    notified.current = noAcne.key;
    notify({ tone: 'warning', title: noAcne.title, message: noAcne.message });
  }, [noAcne, notify]);
  const noSuggestion = current?.verdict === 'no_acne';

  // The mismatch between questionnaire and image is derived by the server from the finished
  // inference, so the case file is re-read once there is one.
  const detail = useApi<CaseDetail>(done ? `/cases/${caseId}` : null, undefined, [
    done,
    current?.completed,
    current?.igaClass,
  ]);
  const mismatch = detail.data?.anamnesisMismatch ?? [];

  return (
    <Card>
      <CardHeader
        title="Análisis asistido"
        description="El sistema analiza las fotografías junto con la anamnesis y propone una clase IGA con su fundamento."
        action={
          done ? (
            <Badge variant="success">Analizado</Badge>
          ) : started ? (
            <Badge variant="outline">En curso</Badge>
          ) : null
        }
      />
      <CardBody className="space-y-4">
        {imageCount === 0 ? (
          <p className="text-sm text-neutral-500">
            Suba al menos una fotografía para poder analizar el caso.
          </p>
        ) : null}

        {imageCount > 0 && protocolIncomplete ? (
          <Alert tone="warning" title="Faltan tomas obligatorias">
            {listShotLabels(missingShots)}. El análisis se habilita cuando el caso tenga la vista
            general y los dos perfiles.
          </Alert>
        ) : null}

        {imageCount > 0 && !anamnesisReady ? (
          <Alert tone="warning" title="Guarde la anamnesis antes de analizar">
            El análisis toma las respuestas tal como estén archivadas en ese momento. Si
            analiza ahora, la lectura saldrá hecha solo con la fotografía y nada indicará después
            que el cuestionario no llegó a viajar con ella.
          </Alert>
        ) : null}

        {!hasViews || failed ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              loading={analyse.pending || (started && running)}
              disabled={imageCount === 0 || protocolIncomplete || !anamnesisReady}
              onClick={() => void analyse.run()}
            >
              <ScanFace className="h-4 w-4" aria-hidden />
              {failed ? 'Reintentar el análisis' : 'Analizar el caso'}
            </Button>
          </div>
        ) : null}

        {running ? (
          <AnalysisProgress
            status={
              current.views.some((v) => v.inference.status === 'ejecutando')
                ? 'ejecutando'
                : 'pendiente'
            }
            expectedSeconds={12 * Math.max(1, current.pending)}
          />
        ) : null}

        {analyse.error !== null || reanalyse.error !== null ? (
          <Alert tone="danger" title="No se pudo encolar el análisis">
            {(analyse.error ?? reanalyse.error)?.message}
          </Alert>
        ) : null}

        {failed ? (
          <Alert tone="danger" title="El análisis falló">
            {latest?.errorMessage ??
              'El motor no devolvió una lectura. Puede reintentarlo; el caso queda igual.'}
          </Alert>
        ) : null}

        {running && started === false ? (
          <Alert tone="info" title="Análisis en curso">
            La cola lo procesa de forma asíncrona; esta pantalla no lo sondea porque no lo lanzó.
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => void analysis.reload()}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Actualizar
            </Button>
          </Alert>
        ) : null}

        {done && current !== null ? (
          <div className="space-y-4">
            <AnamnesisMismatchAlert messages={mismatch} />
            {noAcne !== null ? (
              <Alert tone="warning" title={noSuggestion ? 'Sin sugerencia del sistema' : noAcne.title}>
                {noAcne.message}
              </Alert>
            ) : null}
            {current.verdict === 'piel_sana' ? (
              <Alert tone="info" title="Sugerencia del filtro de piel sana">
                Ninguna toma muestra acné: la clase «Sin lesiones» la sugiere el filtro previo, que
                reconoce la piel sana (pecas incluidas). Los modelos IGA no se ejecutaron.
              </Alert>
            ) : null}
            {noSuggestion ? null : (
              <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs text-neutral-500">Clase IGA sugerida para el caso</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {igaLabel(catalogs, current.igaClass)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Confianza</p>
                  <p className="text-xl font-semibold tabular-nums text-neutral-900">
                    {current.confidence === null ? '—' : pct(current.confidence * 100)}
                  </p>
                </div>
                <div className="ml-auto text-right text-xs text-neutral-500">
                  <p>{current.completed} toma(s) analizadas</p>
                  <p>GAGS: {latest?.gagsScore ?? '—'}</p>
                </div>
              </div>
            )}

            {current.classProbs !== null && current.classProbs !== undefined ? (
              <div className="space-y-1.5">
                {Object.entries(current.classProbs)
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

            <CaseAnalysisMatrix
              analysis={current}
              catalogs={catalogs}
              onChoose={(view, memberTag) => void choose.run(view.inference.id, memberTag)}
              onClearChoice={() => void clearChoice.run()}
              choosing={choose.pending || clearChoice.pending}
            />
            {choose.error !== null || clearChoice.error !== null ? (
              <Alert tone="danger" title="No se pudo guardar la lectura elegida">
                {(choose.error ?? clearChoice.error)?.message}
              </Alert>
            ) : null}

            {current.reading !== null ? (
              <AiAssessment assessment={current.reading} title="Lectura del caso" />
            ) : latest?.assessment !== null && latest?.assessment !== undefined ? (
              <AiAssessment assessment={latest.assessment} />
            ) : null}

            {/* La lectura entra en el historial del paciente, y de ahí que se diga aquí qué es y
                qué no es: quien la lea dentro de seis meses no tendrá esta pantalla delante. */}
            <Alert tone="info" title="Esto es una sugerencia, no un diagnóstico">
              La lectura queda registrada en la historia del paciente como lo que es: una
              sugerencia del sistema. El diagnóstico lo firma el especialista en la ficha del caso,
              y es ese el que vale.
            </Alert>

            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
              <Button
                variant="outline"
                size="sm"
                loading={reanalyse.pending}
                disabled={protocolIncomplete || !anamnesisReady}
                onClick={() => void reanalyse.run()}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Volver a analizar
              </Button>
              <span>
                Versión del análisis: <code>{latest?.modelVersion ?? '—'}</code>
              </span>
            </div>

            {latest?.modelBackend === 'stub' ? (
              <Alert tone="warning" title="Backend de demostración">
                <span className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    El servicio de análisis opera en modo de demostración{' '}
                    <code>{latest.modelVersion}</code>. Esta sugerencia{' '}
                    <strong>no proviene del clasificador entrenado</strong> y no puede citarse
                    como resultado.
                  </span>
                </span>
              </Alert>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
