import { ShieldAlert } from 'lucide-react';

import type { SecondOpinionNotice } from '@/lib/second-opinion';

/**
 * The second opinion's warning, next to the analysis it qualifies.
 *
 * Amber and not red: it does not say the analysis is wrong, it says the photograph may not show
 * acne. Each view is named with what was seen and the model's one-line reason, so the specialist
 * can look at that photograph and judge.
 */
export function SecondOpinionAlert({ notice }: { notice: SecondOpinionNotice | null }) {
  if (notice === null) return null;
  return (
    <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {notice.title}
      </p>
      <p className="mt-1 pl-6 text-sm text-amber-800">{notice.message}</p>
      <ul className="mt-3 space-y-2 pl-6">
        {notice.findings.map((finding) => (
          <li key={finding.imageId} className="text-sm">
            <span className="font-medium text-amber-900">{finding.shot}:</span>{' '}
            <span className="text-amber-900">{finding.headline}</span>
            {finding.explanation !== '' ? (
              <span className="block text-xs text-amber-800">{finding.explanation}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 pl-6 text-xs text-amber-700">
        Verificación automática previa al análisis, informativa; la decisión es del profesional.
      </p>
    </div>
  );
}
