import { Badge } from '@/components/ui/badge';
import { num, pct } from '@/lib/format';
import { igaLabel, type Catalogs } from '@/lib/use-catalogs';
import type { components } from '@/types/api-schema';

type Member = components['schemas']['AiInferenceMemberDto'];
type Agreement = 'unanime' | 'mayoria' | 'discrepancia';

const AGREEMENT: Record<Agreement, { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  unanime: { label: 'Unanimidad', variant: 'success' },
  mayoria: { label: 'Mayoría', variant: 'warning' },
  discrepancia: { label: 'Discrepancia', variant: 'danger' },
};

/**
 * How each model of the ensemble voted, and how far they agreed.
 *
 * The recommendation the physician sees above is the weighted average of these votes (weight =
 * each model's F1 macro on the frozen test split, shown so the reader knows why one vote counts
 * more than another). The table is evidence for the professional, not a menu: the system does not
 * let them "pick" a model, because a confident wrong vote looks exactly like a confident right one.
 */
export function EnsembleVotes({
  members,
  agreement,
  catalogs,
  recommended,
  selectedHeatmap,
  onSelectHeatmap,
}: {
  members: readonly Member[];
  agreement: Agreement | null;
  catalogs: Catalogs | null;
  recommended: string | null;
  /** Heatmap image id currently displayed, to highlight the model whose map it is. */
  selectedHeatmap?: string | null;
  /** Called with the member's heatmap id when the user wants to see that model's Grad-CAM. */
  onSelectHeatmap?: (heatmapImageId: string) => void;
}) {
  if (members.length === 0) return null;
  const badge = agreement === null ? null : AGREEMENT[agreement];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900">Lectura por clasificador</p>
        {badge !== null ? (
          <Badge variant={badge.variant}>
            Acuerdo: {badge.label}
          </Badge>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="py-1 pr-3 font-medium">Clasificador</th>
              <th className="py-1 pr-3 font-medium">Clase</th>
              <th className="py-1 pr-3 font-medium text-right">Confianza</th>
              <th className="py-1 pr-3 font-medium text-right">Peso (F1)</th>
              <th className="py-1 pr-3 font-medium text-right">ms</th>
              {onSelectHeatmap !== undefined ? <th className="py-1 font-medium">Mapa</th> : null}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const agrees = recommended !== null && member.igaClass === recommended;
              const active =
                member.heatmapImageId !== null && member.heatmapImageId === selectedHeatmap;
              return (
                <tr key={member.tag} className="border-t border-neutral-200">
                  <td className="py-1.5 pr-3 font-medium text-neutral-900">{member.tag}</td>
                  <td className="py-1.5 pr-3">
                    <span className={agrees ? 'text-neutral-900' : 'text-amber-700'}>
                      {igaLabel(catalogs, member.igaClass)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {pct(member.confidence * 100)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-neutral-500">
                    {num(member.weight, 3)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-neutral-500">
                    {member.latencyMs}
                  </td>
                  {onSelectHeatmap !== undefined ? (
                    <td className="py-1.5">
                      {member.heatmapImageId !== null ? (
                        <button
                          type="button"
                          onClick={() => onSelectHeatmap(member.heatmapImageId as string)}
                          className={
                            active
                              ? 'rounded-md border-2 border-purple-900 px-2 py-0.5 text-xs font-medium text-purple-900'
                              : 'rounded-md border border-neutral-200 px-2 py-0.5 text-xs text-neutral-500 hover:border-purple-900'
                          }
                        >
                          {active ? 'Mostrando' : 'Ver'}
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500">
        La clase sugerida es la lectura íntegra del clasificador más seguro sobre esta toma; a igual
        confianza gana el de mayor F1 en el conjunto de prueba. Una lectura en ámbar difiere de la
        sugerida.
      </p>
    </div>
  );
}
