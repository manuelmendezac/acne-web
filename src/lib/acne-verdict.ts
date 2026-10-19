import { shotLabel, type ShotDefinitionLike } from '@/lib/shots';

/**
 * What to tell the clinician when the engine's gate found no acne in some or all of the views.
 *
 * The engine's gate sorts each photograph into acne (graded), healthy skin (answered as «sin
 * lesiones»; freckles included) or another condition —vitiligo, psoriasis, rosacea…—, which is not
 * graded. Only the last one is reported here. If no view is gradable the case has no suggestion at
 * all, an incongruence with a case opened for acne: worth a warning, never a block (the specialist
 * still diagnoses).
 */

export interface NoAcneAnalysisLike {
  verdict: 'acne' | 'piel_sana' | 'no_acne' | null;
  noAcneViews: readonly string[];
  views: ReadonlyArray<{ imageId: string; shotKey: string | null }>;
}

export interface NoAcneNotice {
  /** `all`: no view shows acne, no suggestion. `some`: those views were left out. */
  scope: 'all' | 'some';
  title: string;
  message: string;
  /** Stable while the same views are flagged, so a toast is not repeated on every poll. */
  key: string;
}

export function describeNoAcne(
  analysis: NoAcneAnalysisLike | null,
  shots: readonly ShotDefinitionLike[],
): NoAcneNotice | null {
  if (analysis === null || analysis.noAcneViews.length === 0) return null;

  const flagged = analysis.views.filter((view) => analysis.noAcneViews.includes(view.imageId));
  const labels = flagged.map((view) => `«${shotLabel(shots, view.shotKey)}»`).join(', ');
  const key = [...analysis.noAcneViews].sort().join('|');

  if (analysis.verdict === 'no_acne') {
    return {
      scope: 'all',
      title: 'Incongruencia: la imagen no parece corresponder a acné',
      message:
        'Ninguna toma muestra acné ni piel sana según el análisis, así que no hay grado IGA ' +
        'sugerido. Puede tratarse de otra condición de la piel (vitíligo, psoriasis, rosácea…). ' +
        'Verifique las fotografías o valore al paciente; el diagnóstico sigue siendo suyo.',
      key: `all:${key}`,
    };
  }
  return {
    scope: 'some',
    title: 'Aviso: una toma parece mostrar otra condición',
    message:
      `${labels} no ${flagged.length === 1 ? 'muestra' : 'muestran'} acné ni piel sana según el ` +
      'análisis y quedó fuera de la sugerencia del caso. Verifique la fotografía.',
    key: `some:${key}`,
  };
}
