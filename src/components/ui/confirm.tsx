'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/field';

/**
 * Two-step confirmation for an action that is hard to undo.
 *
 * An inline reveal rather than a modal, and the choice is not incidental. A correct modal needs a
 * focus trap, `aria-modal`, scroll locking, focus restoration and inerting the page behind it —
 * five things this codebase has never had to solve, and `jsdom` 25 cannot even run `showModal()`,
 * so a `<dialog>` version would be untestable here. More importantly, revealing in place keeps the
 * row the administrator is acting on visible, which is half of what stops the wrong record being
 * confirmed.
 *
 * The pattern already exists in the portal: `study-mode-switch.tsx` confirms exactly this way.
 */
export function ConfirmAction({
  label,
  icon,
  tone = 'danger',
  title,
  description,
  confirmLabel,
  requireReason = false,
  reasonLabel = 'Motivo',
  reasonMinLength = 10,
  pending = false,
  error = null,
  disabled = false,
  defaultOpen = false,
  onCancel,
  onConfirm,
}: {
  label: string;
  icon?: JSX.Element;
  tone?: 'danger' | 'warning';
  title: string;
  /** What the action does and what it costs. Shown before the confirm button, never after. */
  description: React.ReactNode;
  confirmLabel: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonMinLength?: number;
  pending?: boolean;
  error?: string | null;
  disabled?: boolean;
  /** Start at the confirmation step, for a caller that already asked (a row's action button). */
  defaultOpen?: boolean;
  onCancel?: () => void;
  onConfirm: (reason: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const cancel = (): void => {
    setOpen(false);
    onCancel?.();
  };
  const [reason, setReason] = useState('');
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <Button
        variant={tone === 'danger' ? 'danger' : 'outline'}
        size="sm"
        disabled={disabled}
        onClick={() => {
          setReason('');
          setOpen(true);
        }}
      >
        {icon}
        {label}
      </Button>
    );
  }

  const reasonTooShort = requireReason && reason.trim().length < reasonMinLength;

  return (
    <div
      aria-live="polite"
      onKeyDown={(event) => {
        if (event.key === 'Escape') cancel();
      }}
    >
      <Alert tone={tone} title={title}>
        <div className="space-y-3">
          <div className="text-sm">{description}</div>

          {requireReason ? (
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder={`${reasonLabel} (mínimo ${reasonMinLength} caracteres)`}
              aria-label={reasonLabel}
            />
          ) : null}

          {error !== null ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button
              ref={confirmRef}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              size="sm"
              loading={pending}
              disabled={reasonTooShort}
              onClick={() => onConfirm(reason.trim())}
            >
              {confirmLabel}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={cancel}>
              Cancelar
            </Button>
          </div>
        </div>
      </Alert>
    </div>
  );
}
