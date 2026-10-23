import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { pct } from '@/lib/format';
import { findingFor } from '@/lib/second-opinion';
import { igaLabel, type Catalogs } from '@/lib/use-catalogs';
import type { components } from '@/types/api-schema';

type CaseAnalysis = components['schemas']['CaseAnalysisDto'];
type View = components['schemas']['CaseAnalysisViewDto'];
type Agreement = 'unanime' | 'mayoria' | 'discrepancia';

/** What the second opinion saw in this view, in a few words, when it is not plain acne. */
function secondOpinionOf(view: View): string | null {
  const finding = findingFor(view, []);
  return finding === null ? null : finding.headline;
}

const AGREEMENT: Record<Agreement, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  unanime: { label: 'Unanimidad', variant: 'success' },
  mayoria: { label: 'Mayoría', variant: 'warning' },
  discrepancia: { label: 'Discrepancia', variant: 'danger' },
};

export function shotLabelOf(catalogs: Catalogs | null, shotKey: string | null): string {
  if (shotKey === null) return 'Sin toma';
  return catalogs?.shots?.definitions.find((s) => s.key === shotKey)?.label ?? shotKey;
}

/**
 * The whole analysis at a glance: every view of the protocol × every model, plus the combined
 * suggestion for the case.
 *
 * Rows are the photographs analysed (vista general, perfiles); columns are the ensemble members
 * and, last, the ensemble's reading of that view: the member that was surest about it, whole. The
 * «Caso» row applies the majority / most-confident-view rule. Cells that disagree with the case
 * suggestion are amber,
 * so the specialist sees at once where the evidence is thin. A cell can open that model's
 * Grad-CAM for that view when `onSelectHeatmap` is given.
 *
 * With `onChoose`, every cell also offers «usar»: the clinician points at the reading — one view,
 * and optionally one model — that should stand as the case suggestion instead of the rule. The
 * chosen cell is outlined, the «Caso» row says who chose it, and `onClearChoice` goes back to
 * the automatic rule. The choice lives on the server (`analysis.selection`), never here.
 */
export function CaseAnalysisMatrix({
  analysis,
  catalogs,
  selectedHeatmap,
  onSelectHeatmap,
  onChoose,
  onClearChoice,
  choosing = false,
}: {
  analysis: CaseAnalysis;
  catalogs: Catalogs | null;
  selectedHeatmap?: string | null;
  onSelectHeatmap?: (view: View, heatmapImageId: string) => void;
  onChoose?: (view: View, memberTag: string | null) => void;
  onClearChoice?: () => void;
  choosing?: boolean;
}) {
  const done = analysis.views.filter((v) => v.inference.status === 'exitoso');
  const [expanded, setExpanded] = useState<string | null>(null);
  if (done.length === 0) return null;

  const memberTags = Array.from(
    new Set(done.flatMap((v) => (v.inference.members ?? []).map((m) => m.tag))),
  );
  const recommended = analysis.igaClass;
  const badge = analysis.agreement === null ? null : AGREEMENT[analysis.agreement];
  const selection = analysis.selection ?? null;
  const isChosen = (view: View, memberTag: string | null): boolean =>
    selection !== null &&
    selection.active &&
    selection.inferenceId === view.inference.id &&
    selection.memberTag === memberTag;

  const cell = (
    view: View,
    igaClass: string | null,
    confidence: number | null,
    heatmapImageId: string | null,
    memberTag: string | null,
  ) => {
    if (igaClass === null) return <span className="text-neutral-400">—</span>;
    const agrees = recommended !== null && igaClass === recommended;
    const active = heatmapImageId !== null && heatmapImageId === selectedHeatmap;
    const chosen = isChosen(view, memberTag);
    const body = (
      <>
        <span className={agrees ? 'text-neutral-900' : 'text-amber-700'}>
          {igaLabel(catalogs, igaClass)}
        </span>
        <span className="block text-xs tabular-nums text-neutral-500">
          {confidence === null ? '—' : pct(confidence * 100)}
        </span>
      </>
    );
    const reading =
      onSelectHeatmap === undefined || heatmapImageId === null ? (
        body
      ) : (
        <button
          type="button"
          title="Ver el mapa de atención de este clasificador sobre esta toma"
          onClick={() => onSelectHeatmap(view, heatmapImageId)}
          className={
            active
              ? 'w-full rounded-md border-2 border-purple-900 px-1 py-0.5 text-left'
              : 'w-full rounded-md border border-transparent px-1 py-0.5 text-left hover:border-purple-900'
          }
        >
          {body}
        </button>
      );
    if (onChoose === undefined) return reading;
    return (
      <span className={chosen ? 'block rounded-md bg-emerald-50 ring-2 ring-emerald-600' : 'block'}>
        {reading}
        {chosen ? (
          <span className="block px-1 text-xs font-semibold uppercase text-emerald-700">
            elegida
          </span>
        ) : (
          <button
            type="button"
            disabled={choosing}
            title="Usar esta lectura como sugerencia del caso"
            onClick={() => onChoose(view, memberTag)}
            className="block px-1 text-xs font-normal text-emerald-700 underline-offset-2 hover:underline disabled:opacity-50"
          >
            usar
          </button>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900">
          Análisis por toma y por clasificador
        </p>
        <span className="flex items-center gap-2 text-xs text-neutral-500">
          {analysis.pending > 0 ? <span>{analysis.pending} toma(s) en proceso</span> : null}
          {analysis.failed > 0 ? <span className="text-red-700">{analysis.failed} fallida(s)</span> : null}
          {badge !== null ? (
            <Badge variant={badge.variant}>Acuerdo entre tomas: {badge.label}</Badge>
          ) : null}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="py-1 pr-3 font-medium">Toma</th>
              {memberTags.map((tag) => (
                <th key={tag} className="py-1 pr-3 font-medium">
                  {tag}
                </th>
              ))}
              <th className="py-1 pr-3 font-medium">Combinado</th>
            </tr>
          </thead>
          <tbody>
            {done.map((view) => {
              const members = view.inference.members ?? [];
              const decisive = analysis.decidedBy.includes(view.imageId);
              return (
                <tr
                  key={view.imageId}
                  className={
                    decisive
                      ? 'border-t border-neutral-200 bg-purple-50/60 align-top'
                      : 'border-t border-neutral-200 align-top'
                  }
                >
                  <td className="py-1.5 pr-3 font-medium text-neutral-900">
                    {shotLabelOf(catalogs, view.shotKey)}
                    {decisive ? (
                      <span className="ml-1 text-xs font-semibold uppercase text-purple-900">
                        decide
                      </span>
                    ) : null}
                    {secondOpinionOf(view) !== null ? (
                      <span className="mt-1 block w-fit rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-300">
                        Verificación: {secondOpinionOf(view)}
                      </span>
                    ) : null}
                  </td>
                  {view.inference.verdict === 'no_acne' ? (
                    <td colSpan={memberTags.length + 1} className="py-1.5 pr-3 text-amber-700">
                      {view.inference.verdictSource === 'segunda_opinion'
                        ? `${secondOpinionOf(view) ?? 'Otra condición'} según la verificación previa: no se graduó`
                        : 'Otra condición según el filtro: no se graduó'}
                      {view.inference.acneProbability !== null ? (
                        <span className="block text-xs tabular-nums text-neutral-500">
                          Probabilidad de acné {pct(view.inference.acneProbability * 100)}
                        </span>
                      ) : null}
                    </td>
                  ) : null}
                  {/* Piel sana: los modelos IGA no corrieron; la lectura (sin lesiones) es del
                      filtro, y se puede elegir como cualquier otra en la columna Ensemble. */}
                  {view.inference.verdict === 'piel_sana' && memberTags.length > 0 ? (
                    <td colSpan={memberTags.length} className="py-1.5 pr-3 text-emerald-700">
                      Piel sana según el filtro (los modelos IGA no se ejecutaron)
                    </td>
                  ) : null}
                  {view.inference.verdict === 'no_acne' || view.inference.verdict === 'piel_sana'
                    ? null
                    : memberTags.map((tag) => {
                    const member = members.find((m) => m.tag === tag);
                    return (
                      <td key={tag} className="py-1.5 pr-3">
                        {member === undefined
                          ? cell(view, null, null, null, tag)
                          : cell(
                              view,
                              member.igaClass,
                              member.confidence,
                              member.heatmapImageId,
                              tag,
                            )}
                      </td>
                    );
                  })}
                  {view.inference.verdict === 'no_acne' ? null : analysis.healthyViewsSetAside.includes(
                      view.imageId,
                    ) ? (
                    /* Piel sana junto a una toma con acné: su «sin lesiones» lleva la probabilidad
                       del filtro, no un grado, y no compite con las lesiones de la otra mejilla. */
                    <td className="py-1.5 pr-3 text-neutral-500">
                      <span className="block font-medium">Descartada</span>
                      <span className="block text-xs">
                        Otra toma muestra acné; esta no participa de la sugerencia.
                      </span>
                    </td>
                  ) : (
                    <td className="py-1.5 pr-3 font-semibold">
                      {cell(
                        view,
                        view.inference.igaClass,
                        view.inference.confidence,
                        view.inference.heatmapImageId,
                        null,
                      )}
                      {view.inference.verdict === 'piel_sana' ? null : (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((current) =>
                              current === view.imageId ? null : view.imageId,
                            )
                          }
                          className="mt-1 block text-xs font-normal text-purple-900 underline-offset-2 hover:underline"
                        >
                          {expanded === view.imageId ? 'ocultar cálculo' : 'ver cálculo'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {done
              .filter((view) => view.imageId === expanded)
              .map((view) => (
                <tr key={`${view.imageId}-detail`} className="bg-neutral-50">
                  <td colSpan={memberTags.length + 2} className="px-2 py-2">
                    <VectorBreakdown view={view} catalogs={catalogs} />
                  </td>
                </tr>
              ))}
            {recommended !== null && analysis.classProbs !== null ? (
              <tr className="border-t-2 border-neutral-300 bg-neutral-50">
                <td className="py-1.5 pr-3 font-semibold text-neutral-900">Caso</td>
                <td className="py-1.5 pr-3 text-xs text-neutral-600" colSpan={memberTags.length}>
                  {analysis.ruleDescription}
                  {analysis.range !== null && analysis.range.min !== analysis.range.max ? (
                    <span className="block text-neutral-500">
                      Rango entre tomas: {igaLabel(catalogs, analysis.range.min)} –{' '}
                      {igaLabel(catalogs, analysis.range.max)}
                    </span>
                  ) : null}
                  {analysis.rule === 'seleccion_manual' && onClearChoice !== undefined ? (
                    <button
                      type="button"
                      disabled={choosing}
                      onClick={onClearChoice}
                      className="mt-1 block text-purple-900 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      Volver a la regla automática
                    </button>
                  ) : null}
                  {selection !== null && !selection.active ? (
                    <span className="block text-amber-700">
                      La lectura elegida antes ya no está vigente (el caso se reanalizó); rige la
                      regla automática hasta que se elija otra.
                    </span>
                  ) : null}
                </td>
                <td className="py-1.5 pr-3 font-bold text-purple-900">
                  {igaLabel(catalogs, recommended)}
                  <span className="block text-xs font-normal tabular-nums text-neutral-500">
                    {analysis.confidence === null ? '—' : pct(analysis.confidence * 100)}
                  </span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">
        Cada celda es la lectura de un clasificador sobre una toma; la columna Combinado repite la
        del clasificador que estuvo más seguro en esa toma (no se promedia nada). La fila «Caso»
        sigue la regla «mayoría de tomas; si todas difieren, la toma más segura», y las tomas
        marcadas «decide» son las que la produjeron. Una celda en ámbar difiere de la clase
        sugerida.
        {onSelectHeatmap !== undefined ? ' Pulse una celda para ver su mapa de atención.' : ''}
        {onChoose !== undefined
          ? ' «Usar» fija esa lectura como sugerencia del caso en lugar de la regla; queda registrado quién la eligió.'
          : ''}
      </p>
    </div>
  );
}


/**
 * Why one view's Ensemble cell says what it says.
 *
 * The rule is «the surest model speaks for the ensemble»: among the models that read this view,
 * the one with the highest confidence gives the class and the percentage, whole. Ties go to the
 * model with the higher F1 on the frozen test. The table shows every model's five percentages so
 * the specialist can see how far the others were from that pick.
 */
function VectorBreakdown({ view, catalogs }: { view: View; catalogs: Catalogs | null }) {
  const members = view.inference.members ?? [];
  const classes = Object.keys(view.inference.classProbs ?? {});
  const winner = view.inference.igaClass;
  const surest = members.reduce<(typeof members)[number] | null>(
    (best, m) =>
      best === null ||
      m.confidence > best.confidence ||
      (m.confidence === best.confidence && m.weight > best.weight)
        ? m
        : best,
    null,
  );
  const runnersUp = members.filter((m) => m !== surest);
  const explanation =
    winner === null || surest === null
      ? ''
      : `Gana ${surest.tag} con ${(surest.confidence * 100).toFixed(1)} % en ${igaLabel(catalogs, winner)}` +
        (runnersUp.length > 0
          ? `; ${runnersUp
              .map(
                (m) =>
                  `${m.tag} estaba al ${(m.confidence * 100).toFixed(1)} % en ${igaLabel(catalogs, m.igaClass)}`,
              )
              .join(' y ')}.`
          : '.');

  return (
    <div className="space-y-1 text-xs">
      <table className="w-full">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="py-0.5 pr-2 font-medium">Clasificador</th>
            {classes.map((c) => (
              <th key={c} className="py-0.5 pr-2 text-right font-medium">
                {igaLabel(catalogs, c)}
              </th>
            ))}
            <th className="py-0.5 text-right font-medium">F1 (desempate)</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              key={m.tag}
              className={
                m === surest
                  ? 'border-t border-neutral-200 bg-purple-50/60'
                  : 'border-t border-neutral-200'
              }
            >
              <td className="py-0.5 pr-2 text-neutral-900">
                {m.tag}
                {m === surest ? (
                  <span className="ml-1 text-xs font-semibold uppercase text-purple-900">
                    gana
                  </span>
                ) : null}
              </td>
              {classes.map((c) => (
                <td
                  key={c}
                  className={
                    c === m.igaClass
                      ? 'py-0.5 pr-2 text-right font-semibold tabular-nums text-neutral-900'
                      : 'py-0.5 pr-2 text-right tabular-nums text-neutral-600'
                  }
                >
                  {((m.classProbs[c] ?? 0) * 100).toFixed(1)}%
                </td>
              ))}
              <td className="py-0.5 text-right tabular-nums text-neutral-600">{m.weight.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-neutral-600">
        Cada clasificador reparte el 100 % entre las cinco clases; la lectura combinada toma tal
        cual la del clasificador más seguro en esta toma (a igual confianza, el de mayor F1).{' '}
        {explanation}
      </p>
    </div>
  );
}
