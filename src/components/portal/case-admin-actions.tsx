'use client';

import { Ban, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ConfirmAction } from '@/components/ui/confirm';
import { Alert } from '@/components/ui/feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { api, type GetResult, type PostResult } from '@/lib/api';
import { useAction, useApi, useDebouncedValue } from '@/lib/use-api';

type CaseDetail = GetResult<'/cases/{id}'>;
type CaseRemoval = NonNullable<CaseDetail['removal']>;
type Assignee = GetResult<'/cases/assignees'>[number];
type Patient = GetResult<'/patients'>[number];
export type CaseRemovalResult = PostResult<'/cases/{id}/remove'>;

/**
 * Corregir o quitar un caso. Para los tres roles, por decisión del equipo (25/10/2026).
 *
 * - **Editar:** paciente (si se eligió mal), profesional asignado y notas. Las fotos y la anamnesis
 *   se corrigen desde «Continuar ingreso»; el patrón de consenso, desde quien diagnostica.
 * - **Eliminar:** la API decide si el caso se BORRA (no produjo evidencia del estudio) o se ANULA
 *   (ya tiene diagnóstico, revisión medida, análisis o receta), y el texto lo dice ANTES de
 *   confirmar, con la evidencia que obliga a anular. Pide siempre el motivo.
 */
export function CaseAdminActions({
  caseId,
  onChanged,
  onRemoved,
}: {
  caseId: string;
  /** After an edit: the caller re-reads whatever it shows. */
  onChanged?: () => void;
  onRemoved: (result: CaseRemovalResult) => void;
}): JSX.Element | null {
  const detail = useApi<CaseDetail>(`/cases/${caseId}`);
  const [editing, setEditing] = useState(false);

  const current = detail.data;
  if (current === null || current.voidedAt !== null) return null;

  return (
    <Card>
      <CardHeader
        title="Gestión del caso"
        description="Corregir el paciente, el profesional asignado o las notas, o quitar el caso."
      />
      <CardBody className="space-y-4">
        {editing ? (
          <EditCaseForm
            current={current}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              detail.reload();
              onChanged?.();
            }}
          />
        ) : (
          <div className="flex flex-wrap items-start gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" aria-hidden />
              Editar caso
            </Button>
            <RemoveCaseConfirm
              caseId={current.id}
              caseCode={current.caseCode}
              removal={current.removal}
              onRemoved={onRemoved}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * The two-step «Eliminar caso» / «Anular caso», wording included. Shared by the case's own panel and
 * by each row of the tray.
 */
export function RemoveCaseConfirm({
  caseId,
  caseCode,
  removal,
  onRemoved,
  defaultOpen = false,
  onCancel,
}: {
  caseId: string;
  caseCode: string;
  removal: CaseRemoval | null;
  onRemoved: (result: CaseRemovalResult) => void;
  defaultOpen?: boolean;
  onCancel?: () => void;
}): JSX.Element {
  const remove = useAction(async (reason: string) => {
    const result = await api.post<CaseRemovalResult>(`/cases/${caseId}/remove`, { reason });
    onRemoved(result);
    return result;
  });
  const annul = removal?.mode === 'anular';

  return (
    <ConfirmAction
      label={annul ? 'Anular caso' : 'Eliminar caso'}
      icon={
        annul ? <Ban className="h-4 w-4" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />
      }
      title={annul ? `¿Anular el caso ${caseCode}?` : `¿Eliminar el caso ${caseCode}?`}
      description={
        annul ? (
          <>
            El caso ya tiene {(removal?.evidence ?? []).join(', ')}. Eso es evidencia del estudio y
            no se borra: el caso se <strong>anula</strong>. Sale de la bandeja, de los indicadores y
            de las exportaciones, y queda registrado quién lo anuló y por qué. No se puede deshacer.
          </>
        ) : (
          <>
            El caso todavía no tiene diagnóstico, revisión ni análisis. Se <strong>borrará</strong>{' '}
            junto con sus fotografías y su anamnesis. No se puede deshacer.
          </>
        )
      }
      confirmLabel={annul ? 'Anular el caso' : 'Eliminar el caso'}
      requireReason
      reasonLabel="Motivo"
      pending={remove.pending}
      error={remove.error?.message ?? null}
      defaultOpen={defaultOpen}
      onCancel={onCancel}
      onConfirm={(reason) => void remove.run(reason)}
    />
  );
}

function EditCaseForm({
  current,
  onCancel,
  onSaved,
}: {
  current: CaseDetail;
  onCancel: () => void;
  onSaved: () => void;
}): JSX.Element {
  const [patientId, setPatientId] = useState(current.patientId);
  const [assignedUserId, setAssignedUserId] = useState(current.assignedUserId ?? '');
  const [notes, setNotes] = useState(current.notes ?? '');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);

  const assignees = useApi<Assignee[]>('/cases/assignees');
  const patients = useApi<Patient[]>(debouncedSearch === '' ? null : '/patients', {
    search: debouncedSearch,
  });

  const save = useAction(async () => {
    const changes: Record<string, string> = {};
    if (patientId !== current.patientId) changes['patientId'] = patientId;
    if (assignedUserId !== '' && assignedUserId !== current.assignedUserId) {
      changes['assignedUserId'] = assignedUserId;
    }
    if (notes !== (current.notes ?? '')) changes['notes'] = notes;
    if (Object.keys(changes).length > 0) await api.patch(`/cases/${current.id}`, changes);
    onSaved();
    return true;
  });

  const currentLabel = current.patientName ?? current.patientCode;
  const chosen = (patients.data ?? []).find((patient) => patient.id === patientId);

  return (
    <div className="space-y-4">
      <Field label="Paciente">
        <div className="space-y-2">
          <p className="text-sm text-neutral-700">
            {patientId === current.patientId
              ? `Actual: ${currentLabel}`
              : `Nuevo: ${chosen?.fullName ?? chosen?.patientCode ?? patientId}`}
          </p>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar otro paciente por nombre o código…"
            aria-label="Buscar paciente"
          />
          {(patients.data ?? []).length > 0 ? (
            <ul className="max-h-48 divide-y divide-neutral-100 overflow-auto rounded-md border border-neutral-200">
              {(patients.data ?? []).map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    onClick={() => setPatientId(patient.id)}
                    className={
                      'w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 ' +
                      (patient.id === patientId ? 'bg-purple-50 font-medium text-purple-900' : '')
                    }
                  >
                    {patient.fullName ?? patient.patientCode}{' '}
                    <span className="font-mono text-xs text-neutral-500">
                      {patient.patientCode}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-neutral-500">
            Solo mientras el caso no tenga diagnóstico ni receta: esos se emitieron para el paciente
            actual.
          </p>
        </div>
      </Field>

      <Field label="Profesional asignado">
        <Select value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value)}>
          {assignedUserId === '' ? <option value="">Sin asignar</option> : null}
          {(assignees.data ?? []).map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName} ({person.role})
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Notas">
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          maxLength={2000}
        />
      </Field>

      {save.error !== null ? (
        <Alert tone="danger" title="No se pudo guardar">
          {save.error.message}
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button size="sm" loading={save.pending} onClick={() => void save.run()}>
          Guardar cambios
        </Button>
        <Button variant="ghost" size="sm" disabled={save.pending} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
