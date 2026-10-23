'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useAction } from '@/lib/use-api';

const MIN_REASON = 15;

/**
 * Corrección de un diagnóstico por el administrador.
 *
 * Es para errores de captura, no para cambiar el criterio clínico: la clase original queda en la
 * fila junto con el motivo, quien corrigió y cuándo, y las exportaciones marcan la medición como
 * corregida. La lectura de la IA no se toca.
 */
export function DiagnosisCorrection({
  diagnosisId,
  currentClass,
  classes,
  labels,
  onCorrected,
  defaultOpen = false,
  onClose,
}: {
  diagnosisId: string;
  currentClass: string;
  classes: string[];
  labels: Record<string, string>;
  onCorrected: () => void;
  /** Abre el formulario de entrada (cuando el botón vive fuera, como en la tabla del Anexo 5). */
  defaultOpen?: boolean;
  onClose?: () => void;
}) {
  const { notify } = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [igaClass, setIgaClass] = useState(currentClass);
  const [reason, setReason] = useState('');

  const correct = useAction(async () =>
    api.post(`/diagnoses/${diagnosisId}/correct`, { igaClass, reason: reason.trim() }),
  );

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Corregir resultado
      </Button>
    );
  }

  const valid = igaClass !== currentClass && reason.trim().length >= MIN_REASON;

  return (
    <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3">
      <Alert tone="warning">
        La clase original, el motivo y su usuario quedan registrados y la medición se marca como
        corregida en las exportaciones.
      </Alert>
      <Field label="Clase IGA correcta">
        <Select value={igaClass} onChange={(event) => setIgaClass(event.target.value)}>
          {classes.map((value) => (
            <option key={value} value={value}>
              {labels[value] ?? value}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Motivo de la corrección"
        hint={`Qué se registró mal y con qué evidencia se corrige (mínimo ${MIN_REASON} caracteres).`}
        error={correct.error?.message ?? null}
      >
        <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
      </Field>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!valid || correct.pending}
          onClick={async () => {
            const result = await correct.run();
            if (result === null) return;
            notify({ tone: 'success', title: 'Resultado corregido', message: 'Quedó registrado en la auditoría.' });
            setOpen(false);
            setReason('');
            onCorrected();
            onClose?.();
          }}
        >
          {correct.pending ? 'Guardando…' : 'Guardar corrección'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            onClose?.();
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
