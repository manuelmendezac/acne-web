import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * What the intake desk sees while the engine reads the case.
 *
 * The inference is asynchronous (queue + engine) and, with the ensemble, takes a few seconds:
 * three models plus three Grad-CAM. A static "En curso" badge reads as frozen. The bar is not a
 * measurement — the API reports no progress — but an honest *estimate* that advances with the
 * elapsed time and never reaches the end on its own; the result replaces it when it lands.
 */
export function AnalysisProgress({
  status,
  expectedSeconds = 20,
}: {
  status: string;
  /** Roughly how long a run takes on this machine; shapes the curve, not a promise. */
  expectedSeconds?: number;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  // Approaches 92 % asymptotically: fast at first, then slower, never "done" by itself.
  const percent = Math.round(92 * (1 - Math.exp(-elapsed / expectedSeconds)));
  const stage =
    status === 'pendiente'
      ? 'En cola: esperando al servicio de análisis…'
      : elapsed < 3
        ? 'Preparando la fotografía…'
        : 'Analizando las tomas y generando los mapas de atención…';

  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-neutral-700">
          <Loader2 className="h-4 w-4 animate-spin text-purple-900" aria-hidden />
          {stage}
        </span>
        <span className="tabular-nums text-neutral-500">{elapsed} s</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-purple-900 transition-[width] duration-500 ease-out animate-pulse"
          style={{ width: `${Math.max(4, percent)}%` }}
        />
      </div>
      <p className="text-xs text-neutral-500">
        La lectura aparece aquí en cuanto termina; puede seguir completando el ingreso mientras
        tanto.
      </p>
    </div>
  );
}
