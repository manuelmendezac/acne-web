'use client';

import { Ban, FileDown, Pill, Plus, Search, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ConfirmAction } from '@/components/ui/confirm';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, EmptyState, Loading } from '@/components/ui/feedback';
import { api, type GetResult } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/use-api';
import { useCatalogs } from '@/lib/use-catalogs';

type Prescription = GetResult<'/prescriptions/{id}'>;
type Medication = GetResult<'/prescriptions/medications'>[number];

/** Un renglón mientras se arma, antes de emitirse. */
interface DraftItem {
  medicationId: string | null;
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  indication: string | null;
}

const EMPTY_ITEM: DraftItem = {
  medicationId: null,
  name: '',
  dose: '',
  frequency: '',
  duration: '',
  quantity: 1,
  indication: null,
};

/**
 * La receta que cierra la consulta.
 *
 * Aparece solo cuando el caso ya tiene diagnóstico: prescribir antes de juzgar sería recetar a
 * ciegas, y el servidor lo rechazaría de todos modos porque la receta cuelga del diagnóstico que
 * la fundamenta.
 *
 * Ninguna parte de esta pantalla alimenta un indicador. El cronómetro de OE1 ya se detuvo al
 * enviar el diagnóstico, así que el tiempo que el especialista dedique aquí no infla TRM — que es
 * exactamente lo que se buscaba al separar las dos acciones.
 */
export function PrescriptionPanel({
  caseId,
  hasDiagnosis,
  canPrescribe,
  canSend,
}: {
  caseId: string;
  hasDiagnosis: boolean;
  canPrescribe: boolean;
  canSend: boolean;
}) {
  const { data: catalogs } = useCatalogs();
  const prescriptions = useApi<Prescription[]>(`/prescriptions/case/${caseId}`);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [instructions, setInstructions] = useState('');

  const emit = useAction(async () =>
    api.post('/prescriptions', {
      caseId,
      instructions: instructions.trim() === '' ? undefined : instructions.trim(),
      items: items.map((item) => ({
        medicationId: item.medicationId ?? undefined,
        name: item.name.trim(),
        dose: item.dose.trim(),
        frequency: item.frequency.trim(),
        duration: item.duration.trim(),
        quantity: item.quantity,
        indication: item.indication ?? undefined,
      })),
    }),
  );

  const complete = items.length > 0 && items.every((item) =>
    [item.name, item.dose, item.frequency, item.duration].every((value) => value.trim() !== ''),
  );

  async function handleEmit(): Promise<void> {
    const result = await emit.run();
    if (result === null) return;
    setItems([]);
    setInstructions('');
    prescriptions.reload();
  }

  if (!hasDiagnosis) {
    return (
      <Card>
        <CardHeader title="Receta" description="Se emite una vez firmado el diagnóstico." />
        <CardBody>
          <EmptyState
            title="Todavía no hay diagnóstico"
            description="Primero emita el diagnóstico del caso. La receta cuelga del juicio que la fundamenta, de modo que no puede precederlo."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {canPrescribe ? (
        <Card>
          <CardHeader
            title="Nueva receta"
            description="El tratamiento que se lleva el paciente."
          />
          <CardBody className="space-y-4">
            <MedicationSearch
              onPick={(item) => setItems((current) => [...current, item])}
              disabled={items.length >= 12}
            />

            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-neutral-200 px-3 py-6 text-center text-sm text-neutral-500">
                Busque un medicamento arriba o agregue un renglón en blanco.
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((item, index) => (
                  <li key={index} className="rounded-md border border-neutral-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900">
                          {item.name === '' ? `Medicamento ${index + 1}` : item.name}
                        </p>
                        {item.indication !== null ? (
                          <p className="text-xs text-neutral-500">{item.indication}</p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar el medicamento ${index + 1}`}
                        onClick={() =>
                          setItems((current) => current.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-red-700" aria-hidden />
                      </Button>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <ItemField
                        label="Medicamento"
                        value={item.name}
                        onChange={(value) => updateItem(setItems, index, { name: value })}
                      />
                      <ItemField
                        label="Dosis"
                        value={item.dose}
                        onChange={(value) => updateItem(setItems, index, { dose: value })}
                      />
                      <ItemField
                        label="Frecuencia"
                        value={item.frequency}
                        onChange={(value) => updateItem(setItems, index, { frequency: value })}
                      />
                      <ItemField
                        label="Duración"
                        value={item.duration}
                        onChange={(value) => updateItem(setItems, index, { duration: value })}
                      />
                      <Field label="Cantidad">
                        <Input
                          type="number"
                          min={1}
                          max={999}
                          value={String(item.quantity)}
                          onChange={(event) =>
                            updateItem(setItems, index, {
                              quantity: Math.max(1, Number(event.target.value) || 1),
                            })
                          }
                        />
                      </Field>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setItems((current) => [...current, { ...EMPTY_ITEM }])}
              disabled={items.length >= 12}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Agregar renglón en blanco
            </Button>

            <Field
              label="Indicaciones generales (opcional)"
              hint="Van al pie de la receta, aparte de las de cada medicamento."
            >
              <Textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="Ej. Suspender si aparece irritación intensa y volver a control."
                maxLength={1000}
              />
            </Field>

            {emit.error !== null ? (
              <Alert tone="danger" title="No se pudo emitir la receta">
                {emit.error.message}
              </Alert>
            ) : null}

            <Button block loading={emit.pending} disabled={!complete} onClick={handleEmit}>
              <Pill className="h-4 w-4" aria-hidden />
              Emitir receta
            </Button>

            <p className="text-xs text-neutral-500">
              Queda firmada con una huella SHA-256 del contenido. No es una firma electrónica
              reconocida legalmente: sirve para detectar que un PDF descargado no coincide con lo
              registrado.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Recetas emitidas"
          description="Una receta emitida no se edita: se anula y se emite otra."
        />
        <CardBody>
          {prescriptions.loading ? (
            <Loading />
          ) : (prescriptions.data ?? []).length === 0 ? (
            <EmptyState
              title="Sin recetas"
              description="Este caso todavía no tiene tratamiento prescrito."
            />
          ) : (
            <ul className="space-y-4">
              {(prescriptions.data ?? []).map((prescription) => (
                <PrescriptionCard
                  key={prescription.id}
                  prescription={prescription}
                  canSend={canSend}
                  canAnnul={canPrescribe}
                  channels={catalogs?.deliveryChannels ?? null}
                  onChanged={() => prescriptions.reload()}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function updateItem(
  setItems: React.Dispatch<React.SetStateAction<DraftItem[]>>,
  index: number,
  patch: Partial<DraftItem>,
): void {
  setItems((current) =>
    current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
  );
}

function ItemField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

/**
 * Buscador del vademécum.
 *
 * Al elegir una indicación se rellenan dosis, frecuencia y duración con lo sugerido para ESE uso,
 * que es distinto según para qué se recete el mismo fármaco. Son un punto de partida editable y
 * nunca una prescripción automática: RNF-06 dice que el sistema no prescribe.
 */
function MedicationSearch({
  onPick,
  disabled,
}: {
  onPick: (item: DraftItem) => void;
  disabled: boolean;
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(term), 250);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [term]);

  const results = useApi<Medication[]>(
    debounced.trim() === '' ? null : `/prescriptions/medications`,
    { search: debounced.trim() },
    [debounced],
  );

  return (
    <div className="space-y-2">
      <Field label="Buscar en el vademécum">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <Input
            className="pl-9"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Nombre o principio activo…"
            disabled={disabled}
          />
        </div>
      </Field>

      {debounced.trim() !== '' && !results.loading ? (
        (results.data ?? []).length === 0 ? (
          <p className="text-xs text-neutral-500">
            Sin resultados. Puede agregar el medicamento a mano con el botón de abajo.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {(results.data ?? []).map((medication) =>
              medication.indications.length === 0 ? (
                <li key={medication.id}>
                  <MedicationOption
                    label={medication.name}
                    hint={medication.activeIngredient}
                    onPick={() =>
                      onPick({ ...EMPTY_ITEM, medicationId: medication.id, name: medication.name })
                    }
                  />
                </li>
              ) : (
                medication.indications.map((indication) => (
                  <li key={indication.id}>
                    <MedicationOption
                      label={medication.name}
                      hint={indication.indication}
                      onPick={() =>
                        onPick({
                          medicationId: medication.id,
                          name: medication.name,
                          dose: indication.suggestedDose ?? '',
                          frequency: indication.suggestedFrequency ?? '',
                          duration: indication.suggestedDuration ?? '',
                          quantity: 1,
                          indication: indication.indication,
                        })
                      }
                    />
                  </li>
                ))
              ),
            )}
          </ul>
        )
      ) : null}
    </div>
  );
}

function MedicationOption({
  label,
  hint,
  onPick,
}: {
  label: string;
  hint: string | null;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 text-left text-sm transition-colors hover:border-purple-900 hover:bg-purple-50"
    >
      <span className="min-w-0">
        <span className="block font-medium text-neutral-900">{label}</span>
        {hint !== null ? <span className="block text-xs text-neutral-500">{hint}</span> : null}
      </span>
      <Plus className="h-4 w-4 shrink-0 text-purple-900" aria-hidden />
    </button>
  );
}

function PrescriptionCard({
  prescription,
  canSend,
  canAnnul,
  channels,
  onChanged,
}: {
  prescription: Prescription;
  canSend: boolean;
  canAnnul: boolean;
  channels: { values: string[]; labels: Record<string, string>; simulated: string[] } | null;
  onChanged: () => void;
}) {
  const [channel, setChannel] = useState('whatsapp');
  const [destination, setDestination] = useState('');

  const send = useAction(async () =>
    api.post(`/prescriptions/${prescription.id}/send`, {
      channel,
      destination: destination.trim() === '' ? undefined : destination.trim(),
    }),
  );
  const annul = useAction(async () => api.post(`/prescriptions/${prescription.id}/annul`, {}));
  // El mismo PDF que recibe el paciente por WhatsApp: membrete, diagnóstico, prescripción, firma.
  const download = useAction(async () =>
    api.download(`/prescriptions/${prescription.id}/pdf`, `${prescription.prescriptionCode}.pdf`),
  );

  const annulled = prescription.status === 'anulada';

  return (
    <li
      className={cn(
        'rounded-lg border p-4',
        annulled ? 'border-neutral-200 bg-neutral-50 opacity-70' : 'border-neutral-200',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-medium text-neutral-900">
            {prescription.prescriptionCode}
          </p>
          <p className="text-xs text-neutral-500">
            {prescription.physicianName} · {dateTime(prescription.createdAt)}
          </p>
        </div>
        <Badge variant={annulled ? 'outline' : prescription.status === 'enviada' ? 'success' : 'primary'}>
          {prescription.statusLabel}
        </Badge>
      </div>

      <ul className="mt-3 space-y-1.5">
        {prescription.items.map((item) => (
          <li key={item.id} className="rounded-md bg-neutral-50 px-3 py-2 text-sm">
            <p className="font-medium text-neutral-900">
              {item.name}
              <span className="ml-2 text-xs font-normal text-neutral-500">×{item.quantity}</span>
            </p>
            <p className="text-xs text-neutral-500">
              {item.dose} · {item.frequency} · {item.duration}
            </p>
          </li>
        ))}
      </ul>

      {prescription.instructions !== null ? (
        <p className="mt-3 text-xs text-neutral-500">{prescription.instructions}</p>
      ) : null}

      {prescription.deliveries.length > 0 ? (
        <div className="mt-3 space-y-1">
          {prescription.deliveries.map((delivery) => (
            <div key={delivery.id} className="text-xs text-neutral-500">
              <p className="flex flex-wrap items-center gap-2">
                <Send className="h-3 w-3 shrink-0" aria-hidden />
                {delivery.channelLabel} → {delivery.destination} · {dateTime(delivery.sentAt)}
                {delivery.simulated ? (
                  <Badge variant="warning" className="text-xs">
                    simulado
                  </Badge>
                ) : delivery.successful ? (
                  <Badge variant="success" className="text-xs">
                    aceptado
                  </Badge>
                ) : (
                  <Badge variant="danger" className="text-xs">
                    rechazado
                  </Badge>
                )}
              </p>
              {!delivery.simulated && delivery.detail !== null ? (
                <p className="ml-5 text-xs text-neutral-400">{delivery.detail}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3">
        <Button
          variant="ghost"
          size="sm"
          loading={download.pending}
          onClick={() => void download.run()}
        >
          <FileDown className="h-4 w-4" aria-hidden />
          Descargar PDF
        </Button>
        {download.error !== null ? (
          <p className="mt-1 text-xs text-red-700">{download.error.message}</p>
        ) : null}
      </div>

      {!annulled && (canSend || canAnnul) ? (
        <div className="mt-4 space-y-2 border-t border-neutral-200 pt-3">
          {canSend ? (
            <>
              <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
                <Select value={channel} onChange={(event) => setChannel(event.target.value)}>
                  {(channels?.values ?? ['whatsapp']).map((value) => (
                    <option key={value} value={value}>
                      {channels?.labels[value] ?? value}
                    </option>
                  ))}
                </Select>
                <Input
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="Teléfono o correo (vacío = el de su ficha)"
                />
              </div>

              {channels?.simulated.includes(channel) === true ? (
                <p className="text-xs text-amber-700">
                  El envío por {channels.labels[channel] ?? channel} se registra pero no se ejecuta:
                  el prototipo no tiene pasarela contratada.
                </p>
              ) : null}

              {send.error !== null ? (
                <Alert tone="danger" title="No se pudo enviar">
                  {send.error.message}
                </Alert>
              ) : null}

              <Button
                variant="outline"
                size="sm"
                loading={send.pending}
                onClick={async () => {
                  const result = await send.run();
                  if (result !== null) onChanged();
                }}
              >
                <Send className="h-4 w-4" aria-hidden />
                Enviar al paciente
              </Button>
            </>
          ) : null}

          {canAnnul ? (
            <ConfirmAction
              label="Anular"
              icon={<Ban className="h-4 w-4" aria-hidden />}
              title="Anular la receta"
              description="La receta deja de ser válida. El paciente ya tiene la suya impresa, así que avísele antes de emitir la nueva."
              confirmLabel="Anular"
              pending={annul.pending}
              error={annul.error?.message ?? null}
              onConfirm={() => {
                void annul.run().then((result) => {
                  if (result !== null) onChanged();
                });
              }}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
