'use client';

import { Stethoscope } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-api';
import { useCatalogs } from '@/lib/use-catalogs';

/**
 * Definitive diagnosis of the specialist.
 *
 * Submitting closes the whole measurement in one server-side transaction: it stamps `t₁` (OE1),
 * freezes the agreement against the consensus label (OE2) and counts the case towards NCR of the
 * open journey (OE4).
 *
 * When the AI suggestion is visible, the form does NOT preselect it. Pre-filling the physician's
 * answer with the model's would turn "assisted diagnosis" into "confirmation of the model", and
 * the agreement rate OE2 measures would stop meaning anything.
 *
 * La clase IGA es lo ÚNICO obligatorio. El diagnóstico redactado, el CIE-10 y las dos cajas de
 * texto son la parte de historia clínica que el proceso exige y que ningún indicador lee: TPD
 * compara la clase contra el patrón de referencia, y un texto libre no es comparable con nada.
 * Exigirlos convertiría cada medición en un trámite más largo sin mejorar la evidencia.
 */
export function DiagnosisForm({
  caseId,
  aiSuggestion,
  blockedReason = null,
  mismatch,
  onSubmitted,
}: {
  caseId: string;
  aiSuggestion: string | null;
  /** Why the server would refuse the diagnosis right now (missing shots); disables the submit. */
  blockedReason?: string | null;
  /**
   * Anamnesis ↔ image contradictions the server found on the AI suggestion. While there are any,
   * the API refuses the diagnosis unless the specialist acknowledges them with a reason.
   */
  mismatch?: readonly string[];
  onSubmitted: () => void;
}) {
  const { data: catalogs } = useCatalogs();
  const [igaClass, setIgaClass] = useState('');
  const [gagsScore, setGagsScore] = useState('');
  const [definitiveDiagnosis, setDefinitiveDiagnosis] = useState('');
  const [icd10Code, setIcd10Code] = useState('');
  const [patientNotes, setPatientNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [mismatchAcknowledged, setMismatchAcknowledged] = useState(false);
  const [mismatchReason, setMismatchReason] = useState('');
  const hasMismatch = mismatch !== undefined && mismatch.length > 0;
  const mismatchResolved =
    !hasMismatch || (mismatchAcknowledged && mismatchReason.trim().length >= 10);

  const optional = (value: string): string | undefined =>
    value.trim() === '' ? undefined : value.trim();

  const { run, pending, error } = useAction(async () =>
    api.post(`/diagnoses/case/${caseId}`, {
      igaClass,
      gagsScore: gagsScore === '' ? undefined : Number(gagsScore),
      definitiveDiagnosis: optional(definitiveDiagnosis),
      icd10Code: optional(icd10Code),
      patientNotes: optional(patientNotes),
      internalNotes: optional(internalNotes),
      notes: optional(notes),
      ...(aiSuggestion !== null ? { aiSuggestionAccepted: igaClass === aiSuggestion } : {}),
      ...(hasMismatch
        ? { mismatchAcknowledged, mismatchReason: mismatchReason.trim() }
        : {}),
    }),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (igaClass === '') return;
    const result = await run();
    if (result !== null) onSubmitted();
  }

  const classes = catalogs?.iga.classes ?? [];

  return (
    <Card>
      <CardHeader
        title="Diagnóstico del especialista"
        description="Su juicio es el diagnóstico clínicamente vinculante."
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Clase IGA"
            required
            hint="Investigator's Global Assessment: escala ordinal de cinco niveles."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {classes.map((value) => {
                const selected = igaClass === value;
                const isAiSuggestion = aiSuggestion === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setIgaClass(value)}
                    aria-pressed={selected}
                    className={cn(
                      'flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      selected
                        ? 'border-purple-900 bg-purple-50 font-medium text-purple-900'
                        : 'border-neutral-200 text-neutral-900 hover:border-purple-900/50 hover:bg-neutral-100',
                    )}
                  >
                    <span>{catalogs?.iga.labels[value] ?? value}</span>
                    {isAiSuggestion ? (
                      <span className="ml-2 rounded-full bg-purple-900/10 px-2 py-0.5 text-xs font-medium text-purple-900">
                        sugerencia del sistema
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field
            label="Puntaje GAGS (opcional)"
            hint="Escala secundaria Global Acne Grading System, de 0 a 44."
          >
            <Input
              type="number"
              min={0}
              max={44}
              value={gagsScore}
              onChange={(event) => setGagsScore(event.target.value)}
              placeholder="Ej. 24"
            />
          </Field>

          <Field
            label="Diagnóstico redactado (opcional)"
            hint="Lo que iría en la historia clínica. La clase IGA de arriba es la que se mide."
          >
            <Textarea
              value={definitiveDiagnosis}
              onChange={(event) => setDefinitiveDiagnosis(event.target.value)}
              placeholder="Ej. Acné vulgar de predominio inflamatorio en zona centrofacial y espalda."
              maxLength={1000}
            />
          </Field>

          <Field label="Código CIE-10 (opcional)">
            <Select value={icd10Code} onChange={(event) => setIcd10Code(event.target.value)}>
              <option value="">Sin código</option>
              {(catalogs?.icd10 ?? []).map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.code} — {entry.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Indicaciones para el paciente (opcional)"
            hint="Viaja impreso en la receta. Escríbalo en lenguaje que el paciente entienda."
          >
            <Textarea
              value={patientNotes}
              onChange={(event) => setPatientNotes(event.target.value)}
              placeholder="Ej. Lavar el rostro dos veces al día con limpiador suave. No manipular las lesiones."
              maxLength={1000}
            />
          </Field>

          <Field
            label="Notas internas (opcional)"
            hint="El paciente nunca las ve. No escriba aquí nombres ni documentos (Ley N.º 29733)."
          >
            <Textarea
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
              placeholder="Ej. Reevaluar a las 8 semanas; considerar sistémico si no responde."
              maxLength={1000}
            />
          </Field>

          <Field label="Observaciones del estudio (opcional)">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Calidad de la imagen, dudas diagnósticas, incidencias de la medición…"
            />
          </Field>

          {error !== null ? (
            <Alert tone="danger" title="No se pudo registrar el diagnóstico">
              {error.message}
            </Alert>
          ) : null}

          {blockedReason !== null ? (
            <Alert tone="warning" title="El diagnóstico no se puede registrar todavía">
              {blockedReason}
            </Alert>
          ) : null}

          {hasMismatch ? (
            <Alert tone="danger" title="La evaluación asistida y la anamnesis se contradicen">
              <ul className="space-y-1">
                {mismatch?.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
              <p className="mt-2">
                Puede devolver el caso con <strong>Solicitar fotos</strong>, corregir la anamnesis
                y volver a analizar, o mantener el diagnóstico dejando constancia de por qué.
              </p>
              <div className="mt-3 space-y-2">
                <Checkbox
                  label="Revisé la fotografía: corresponde al paciente y a la zona afectada"
                  checked={mismatchAcknowledged}
                  onChange={(event) => setMismatchAcknowledged(event.target.checked)}
                />
                {mismatchAcknowledged ? (
                  <Field
                    label="Motivo (queda en la auditoría)"
                    required
                    hint="Mínimo 10 caracteres."
                  >
                    <Textarea
                      value={mismatchReason}
                      onChange={(event) => setMismatchReason(event.target.value)}
                      rows={2}
                      maxLength={500}
                    />
                  </Field>
                ) : null}
              </div>
            </Alert>
          ) : null}
          <Button
            type="submit"
            block
            loading={pending}
            disabled={igaClass === '' || blockedReason !== null || !mismatchResolved}
          >
            <Stethoscope className="h-4 w-4" aria-hidden />
            Emitir diagnóstico definitivo
          </Button>

          <p className="text-xs text-neutral-500">
            Al enviar se cierra el cronómetro de la revisión y la medición queda registrada como
            evidencia del estudio.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
