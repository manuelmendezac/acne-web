'use client';

import { Pill, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/portal/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Checkbox, Field, Input, LabelledInput, Textarea } from '@/components/ui/field';
import { Alert, EmptyState, ErrorState, Loading } from '@/components/ui/feedback';
import { api, type GetResult } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAction, useApi } from '@/lib/use-api';

type Medication = GetResult<'/prescriptions/medications/all'>[number];

interface DraftIndication {
  indication: string;
  suggestedDose: string;
  suggestedFrequency: string;
  suggestedDuration: string;
}

interface Draft {
  id: string | null;
  name: string;
  activeIngredient: string;
  description: string;
  active: boolean;
  indications: DraftIndication[];
}

const EMPTY_DRAFT: Draft = {
  id: null,
  name: '',
  activeIngredient: '',
  description: '',
  active: true,
  indications: [],
};

/**
 * El almacén: el vademécum del que sale cada receta.
 *
 * La dosis sugerida cuelga de la INDICACIÓN y no del fármaco, que es la única forma de que el
 * buscador de la receta rellene algo útil: la isotretinoína no se pauta igual en un acné moderado
 * que en uno conglobata, y guardar una sola dosis obligaría a corregirla a mano cada vez.
 *
 * Nada de esto alimenta un indicador. Es material de trabajo del especialista, y está en su portal
 * porque es él quien conoce las pautas que receta.
 */
export default function AlmacenPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const medications = useApi<Medication[]>('/prescriptions/medications/all', { search }, [search]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = useAction(async (value: Draft) => {
    const payload = {
      name: value.name.trim(),
      activeIngredient: value.activeIngredient.trim() === '' ? undefined : value.activeIngredient.trim(),
      description: value.description.trim() === '' ? undefined : value.description.trim(),
      active: value.active,
      indications: value.indications
        .filter((entry) => entry.indication.trim() !== '')
        .map((entry) => ({
          indication: entry.indication.trim(),
          suggestedDose: entry.suggestedDose.trim() === '' ? undefined : entry.suggestedDose.trim(),
          suggestedFrequency:
            entry.suggestedFrequency.trim() === '' ? undefined : entry.suggestedFrequency.trim(),
          suggestedDuration:
            entry.suggestedDuration.trim() === '' ? undefined : entry.suggestedDuration.trim(),
        })),
    };
    return value.id === null
      ? api.post('/prescriptions/medications', payload)
      : api.patch(`/prescriptions/medications/${value.id}`, payload);
  });

  async function handleSave(): Promise<void> {
    if (draft === null || draft.name.trim() === '') return;
    const result = await save.run(draft);
    if (result === null) return;
    setDraft(null);
    medications.reload();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Almacén"
        description="El vademécum del que sale cada receta. Las dosis sugeridas cuelgan de la indicación, no del fármaco: un mismo medicamento no se pauta igual según para qué se recete."
      />

      {/*
        * Lista a la izquierda, ficha a la derecha.
        *
        * Estaban una debajo de otra, de modo que abrir un fármaco obligaba a bajar hasta el final
        * de 32 filas para ver su detalle y a volver a subir para elegir el siguiente. La columna se
        * queda pegada al hacer scroll (`lg:sticky`) porque lo que se mueve es la lista.
        */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
        <Card>
          <CardHeader
            title="Medicamentos"
          description="Retirar uno lo saca del buscador de recetas; las ya emitidas siguen siendo legibles."
          action={
            <Button size="sm" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo
            </Button>
          }
        />
        <CardBody className="space-y-4">
          <Field label="Buscar">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                aria-hidden
              />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre o principio activo…"
              />
            </div>
          </Field>

          {medications.loading && medications.data === null ? (
            <Loading />
          ) : medications.error !== null ? (
            <ErrorState message={medications.error.message} onRetry={medications.reload} />
          ) : (medications.data ?? []).length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="Ningún fármaco coincide con la búsqueda."
            />
          ) : (
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1 lg:max-h-[calc(100vh-22rem)]">
              {(medications.data ?? []).map((medication) => (
                <li key={medication.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: medication.id,
                        name: medication.name,
                        activeIngredient: medication.activeIngredient ?? '',
                        description: medication.description ?? '',
                        active: medication.active,
                        indications: medication.indications.map((entry) => ({
                          indication: entry.indication,
                          suggestedDose: entry.suggestedDose ?? '',
                          suggestedFrequency: entry.suggestedFrequency ?? '',
                          suggestedDuration: entry.suggestedDuration ?? '',
                        })),
                      })
                    }
                    className={cn(
                      'flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                      medication.active
                        ? 'border-neutral-200 hover:border-purple-900 hover:bg-purple-50'
                        : 'border-neutral-200 bg-neutral-50 opacity-70 hover:border-neutral-400',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-neutral-900">
                        {medication.name}
                      </span>
                      {medication.activeIngredient !== null ? (
                        <span className="block text-xs text-neutral-500">
                          {medication.activeIngredient}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs text-neutral-500">
                        {medication.indications.length === 0
                          ? 'Sin indicaciones sugeridas'
                          : // El plural de «indicación» pierde la tilde: no es «indicaciónes».
                            `${medication.indications.length} ${medication.indications.length === 1 ? 'indicación' : 'indicaciones'}`}
                      </span>
                    </span>
                    {!medication.active ? <Badge variant="outline">retirado</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          </CardBody>
        </Card>

        {/* `top-6` deja el mismo aire que el `py-6` del contenedor de la página. */}
        <div className="lg:sticky lg:top-6">
          {draft === null ? (
            <Card>
              <CardBody>
                <EmptyState
                  title="Ninguna ficha abierta"
                  description="Elija un medicamento de la lista para ver y editar sus indicaciones, o cree uno nuevo."
                />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title={draft.id === null ? 'Nuevo medicamento' : draft.name}
                description="Cada indicación lleva su propia pauta, que es lo que se rellena al recetar."
              />
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <LabelledInput
                    label="Nombre"
                    required
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="Ej. ISOTRETINOÍNA 20MG"
                  />
                  <LabelledInput
                    label="Principio activo"
                    value={draft.activeIngredient}
                    onChange={(event) => setDraft({ ...draft, activeIngredient: event.target.value })}
                    hint="Entra en la búsqueda junto al nombre."
                  />
                </div>

                <Field label="Descripción (opcional)">
                  <Textarea
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    maxLength={1000}
                  />
                </Field>

                <Checkbox
                  checked={draft.active}
                  onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                  label="Disponible para recetar"
                />

                <div className="space-y-2">
                  <p className="text-sm font-medium text-neutral-900">Indicaciones</p>
                  {draft.indications.map((entry, index) => (
                    <div key={index} className="rounded-md border border-neutral-200 p-3">
                      <div className="flex items-start gap-2">
                        {/*
                          * Área de texto y no un campo de una línea: las indicaciones que trae la
                          * clínica son la instrucción completa —«TOMAR 1 PASTILLA DESPUÉS DEL
                          * ALMUERZO 2 VECES/SEMANA (LUNES Y JUEVES) POR 3 MESES»— y en una sola
                          * línea se cortan justo donde está el dato que importa.
                          */}
                        <Field label="Para qué se usa" className="flex-1">
                          <Textarea
                            rows={2}
                            value={entry.indication}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                indications: draft.indications.map((item, i) =>
                                  i === index ? { ...item, indication: event.target.value } : item,
                                ),
                              })
                            }
                            placeholder="Ej. Acné moderado"
                          />
                        </Field>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mt-6"
                          aria-label={`Quitar la indicación ${index + 1}`}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              indications: draft.indications.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-red-700" aria-hidden />
                        </Button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {(
                          [
                            ['suggestedDose', 'Dosis'],
                            ['suggestedFrequency', 'Frecuencia'],
                            ['suggestedDuration', 'Duración'],
                          ] as const
                        ).map(([key, label]) => (
                          <Field key={key} label={label}>
                            <Input
                              value={entry[key]}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  indications: draft.indications.map((item, i) =>
                                    i === index ? { ...item, [key]: event.target.value } : item,
                                  ),
                                })
                              }
                            />
                          </Field>
                        ))}
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={draft.indications.length >= 20}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        indications: [
                          ...draft.indications,
                          { indication: '', suggestedDose: '', suggestedFrequency: '', suggestedDuration: '' },
                        ],
                      })
                    }
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Agregar indicación
                  </Button>
                </div>

                {save.error !== null ? (
                  <Alert tone="danger" title="No se pudo guardar">
                    {save.error.message}
                  </Alert>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button loading={save.pending} disabled={draft.name.trim() === ''} onClick={handleSave}>
                    <Pill className="h-4 w-4" aria-hidden />
                    Guardar
                  </Button>
                  <Button variant="ghost" onClick={() => setDraft(null)}>
                    Cancelar
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
