import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

// --- Alert -------------------------------------------------------------------

const ALERT_STYLES = {
  info: { box: 'border-purple-900/30 bg-purple-50 text-neutral-900', icon: Info, tint: 'text-purple-900' },
  success: { box: 'border-emerald-600/30 bg-emerald-50 text-neutral-900', icon: CheckCircle2, tint: 'text-emerald-700' },
  warning: { box: 'border-amber-500/40 bg-amber-50 text-neutral-900', icon: AlertTriangle, tint: 'text-amber-600' },
  danger: { box: 'border-red-500/40 bg-red-50 text-neutral-900', icon: XCircle, tint: 'text-red-700' },
} as const;

export type AlertTone = keyof typeof ALERT_STYLES;

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const style = ALERT_STYLES[tone];
  const Icon = style.icon;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md border px-4 py-3 text-sm', style.box, className)}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.tint)} aria-hidden />
      <div className="min-w-0 space-y-1">
        {title !== undefined ? <p className="font-semibold">{title}</p> : null}
        {children !== undefined ? <div className="text-neutral-500">{children}</div> : null}
      </div>
    </div>
  );
}

// --- Loading / empty / error --------------------------------------------------

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-neutral-900">{title}</p>
      {description !== undefined ? (
        <p className="max-w-md text-sm text-neutral-500">{description}</p>
      ) : null}
      {action !== undefined ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert tone="danger" title="No se pudo cargar la información">
      <p>{message}</p>
      {onRetry !== undefined ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-sm font-medium text-red-700 underline underline-offset-4"
        >
          Reintentar
        </button>
      ) : null}
    </Alert>
  );
}

/**
 * Panel shown when `StudyModeGuard` rejects an assisted-evaluation route.
 *
 * Presented as expected behaviour of the study, not as a failure: in the pretest phase the
 * physician is SUPPOSED to diagnose without the system's suggestion (RF-TR-01). The wording stays
 * clinical — it names the phase and the restriction, not the technology behind it.
 */
export function StudyModeBlocked({ children }: { children?: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" aria-hidden />
      <div className="space-y-1.5">
        <p className="font-semibold text-neutral-900">
          Evaluación asistida no disponible en esta fase
        </p>
        <p className="text-neutral-500">
          En la fase actual del estudio el diagnóstico se registra sin la evaluación asistida del
          sistema. La restricción se aplica en el servidor, no solo en esta pantalla, para que
          ninguna lectura pueda influir en la medición.
        </p>
        {children}
        <p className="text-xs text-neutral-500">Fase pretest · RF-TR-01</p>
      </div>
    </div>
  );
}
