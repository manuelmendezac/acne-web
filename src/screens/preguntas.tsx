'use client';

import { ChevronDown, ChevronRight, Lock, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/portal/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ConfirmAction } from '@/components/ui/confirm';
import { Checkbox, Field, Input, LabelledInput, Select, Textarea } from '@/components/ui/field';
import { Alert, ErrorState, Loading } from '@/components/ui/feedback';
import { api, type GetResult } from '@/lib/api';
import { useAction, useApi } from '@/lib/use-api';
import { useCatalogs } from '@/lib/use-catalogs';

type Question = GetResult<'/questions'>[number];

interface Draft {
  key: string;
  section: string;
  text: string;
  type: string;
  scope: string;
  options: string;
  unit: string;
  hint: string;
  detailPrompt: string;
  required: boolean;
}

const EMPTY_DRAFT: Draft = {
  key: '',
  section: 'contexto',
  text: '',
  type: 'booleano',
  scope: 'siempre',
  options: '',
  unit: '',
  hint: '',
  detailPrompt: '',
  required: false,
};

/** Los tipos cuyo valor sale de una lista cerrada, y que por tanto piden opciones. */
const CHOICE_TYPES = ['opcion_unica', 'opcion_multiple'];

/**
 * El cuestionario de ingreso, administrable de principio a fin.
 *
 * La base de datos es la fuente de verdad: lo que se crea aquí se puede responder de inmediato en
 * el ingreso, porque el servidor valida contra esta tabla y no contra una constante del código.
 *
 * Lo que la pantalla protege es lo ya respondido. Una pregunta que alguna anamnesis contestó queda
 * marcada como bloqueada: su clave, su tipo, su ámbito y sus opciones dejan de ser editables —los
 * valores guardados se interpretan según ellos— y tampoco se puede eliminar. La redacción sí se
 * corrige siempre, y desactivarla la retira del ingreso sin tocar el historial.
 */
export default function PreguntasPage(): JSX.Element {
  const { data: catalogs } = useCatalogs();
  const questions = useApi<Question[]>('/questions');
  const [edits, setEdits] = useState<Record<string, Partial<Question>>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  /**
   * Qué pregunta está abierta. Solo una.
   *
   * Las 21 se pintaban todas como formularios desplegados: una página de casi nueve mil píxeles de
   * campos idénticos, imposible de recorrer, donde la pregunta recién creada quedaba enterrada al
   * final y el formulario de alta se perdía entre el resto.
   */
  const [openId, setOpenId] = useState<string | null>(null);

  const save = useAction(async (question: Question, patch: Partial<Question>) =>
    api.patch(`/questions/${question.id}`, {
      ...(patch.text !== undefined ? { text: patch.text } : {}),
      ...(patch.hint !== undefined ? { hint: patch.hint ?? '' } : {}),
      ...(patch.detailPrompt !== undefined ? { detailPrompt: patch.detailPrompt ?? '' } : {}),
      ...(patch.required !== undefined ? { required: patch.required } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.section !== undefined ? { section: patch.section } : {}),
      ...(patch.options !== undefined ? { options: patch.options ?? [] } : {}),
    }),
  );

  const create = useAction(async (value: Draft) =>
    api.post('/questions', {
      key: value.key,
      section: value.section,
      text: value.text,
      type: value.type,
      scope: value.scope,
      ...(CHOICE_TYPES.includes(value.type)
        ? { options: value.options.split('\n').map((o) => o.trim()).filter((o) => o !== '') }
        : {}),
      ...(value.unit.trim() === '' ? {} : { unit: value.unit.trim() }),
      ...(value.hint.trim() === '' ? {} : { hint: value.hint.trim() }),
      ...(value.detailPrompt.trim() === '' ? {} : { detailPrompt: value.detailPrompt.trim() }),
      required: value.required,
    }),
  );

  const remove = useAction(async (id: string) => api.post(`/questions/${id}/remove`, {}));

  async function handleSave(question: Question): Promise<void> {
    const patch = edits[question.id];
    if (patch === undefined) return;
    const result = await save.run(question, patch);
    if (result === null) return;
    setEdits((current) => {
      const next = { ...current };
      delete next[question.id];
      return next;
    });
    questions.reload();
  }

  async function handleCreate(): Promise<void> {
    if (draft === null) return;
    const result = await create.run(draft);
    if (result === null) return;
    setDraft(null);
    questions.reload();
    // Se abre la recién creada: es lo que la persona acaba de escribir y lo que va a querer revisar.
    const created = result as { id?: string };
    if (typeof created.id === 'string') setOpenId(created.id);
  }

  if (questions.loading && questions.data === null) {
    return <Loading label="Cargando el cuestionario…" />;
  }
  if (questions.error !== null) {
    return <ErrorState message={questions.error.message} onRetry={questions.reload} />;
  }

  const sections = catalogs?.anamnesis.sections ?? [];
  const sectionLabel = (code: string): string =>
    catalogs?.anamnesis.sectionLabels[code] ?? code;

  const bySection = new Map<string, Question[]>();
  for (const question of questions.data ?? []) {
    bySection.set(question.section, [...(bySection.get(question.section) ?? []), question]);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Preguntas del ingreso"
        description={`Las ${(questions.data ?? []).length} preguntas que el técnico toma antes de las fotografías.`}
        actions={
          <Button size="sm" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            <Plus className="h-4 w-4" aria-hidden />
            Nueva pregunta
          </Button>
        }
      />

      <Alert tone="info" title="Qué se puede cambiar y qué no">
        Una pregunta que <strong>nadie ha respondido todavía</strong> se edita entera y se elimina.
        En cuanto una anamnesis la contesta queda bloqueada: la clave, el tipo, el ámbito y las
        opciones se congelan —los valores guardados se interpretan según ellos— pero la redacción se
        corrige siempre, y desactivarla la retira del ingreso sin tocar el historial.
      </Alert>

      {draft !== null ? (
        <Card>
          <CardHeader
            title="Nueva pregunta"
            description="Se añade al final del cuestionario y queda disponible de inmediato."
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <LabelledInput
                label="Clave"
                required
                value={draft.key}
                onChange={(event) => setDraft({ ...draft, key: event.target.value })}
                placeholder="Ej. consumo_lacteos"
                hint="Se normaliza a minúsculas sin tildes ni espacios. Es única y no se reutiliza."
              />
              <Field label="Sección" required>
                <Select
                  value={draft.section}
                  onChange={(event) => setDraft({ ...draft, section: event.target.value })}
                >
                  {sections.map((code) => (
                    <option key={code} value={code}>
                      {sectionLabel(code)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Enunciado" required>
              <Textarea
                value={draft.text}
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                placeholder="¿Consume lácteos a diario?"
                maxLength={500}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo de respuesta" required>
                <Select
                  value={draft.type}
                  onChange={(event) => setDraft({ ...draft, type: event.target.value })}
                >
                  <option value="booleano">Sí / No</option>
                  <option value="opcion_unica">Elección única</option>
                  <option value="opcion_multiple">Elección múltiple</option>
                  <option value="texto">Texto libre</option>
                  <option value="numero">Número</option>
                </Select>
              </Field>
              <Field
                label="A quién se le pregunta"
                required
                hint="«Mujer adulta» la limita al bloque hormonal, desde los 18 años."
              >
                <Select
                  value={draft.scope}
                  onChange={(event) => setDraft({ ...draft, scope: event.target.value })}
                >
                  <option value="siempre">A todos</option>
                  <option value="mujer_adulta">Solo mujeres desde los 18</option>
                </Select>
              </Field>
            </div>

            {CHOICE_TYPES.includes(draft.type) ? (
              <Field label="Opciones" required hint="Una por línea. Hacen falta al menos dos.">
                <Textarea
                  rows={4}
                  value={draft.options}
                  onChange={(event) => setDraft({ ...draft, options: event.target.value })}
                  placeholder={'sí\nno\na veces'}
                />
              </Field>
            ) : null}

            {draft.type === 'numero' ? (
              <LabelledInput
                label="Unidad"
                value={draft.unit}
                onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
                placeholder="kg"
              />
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <LabelledInput
                label="Ayuda (opcional)"
                value={draft.hint}
                onChange={(event) => setDraft({ ...draft, hint: event.target.value })}
                hint="Guía clínica bajo el control."
              />
              <LabelledInput
                label="Prompt del detalle (opcional)"
                value={draft.detailPrompt}
                onChange={(event) => setDraft({ ...draft, detailPrompt: event.target.value })}
                hint="Ej. «¿cuál?»"
              />
            </div>

            <Checkbox
              checked={draft.required}
              onChange={(event) => setDraft({ ...draft, required: event.target.checked })}
              label="Obligatoria"
            />

            {create.error !== null ? (
              <Alert tone="danger" title="No se pudo crear">
                {create.error.message}
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                loading={create.pending}
                disabled={draft.key.trim() === '' || draft.text.trim() === ''}
                onClick={handleCreate}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Crear pregunta
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {[...bySection.entries()].map(([section, items]) => (
        <Card key={section}>
          <CardHeader title={sectionLabel(section)} description={`${items.length} preguntas`} />
          <CardBody className="space-y-2">
            {items.map((question) => {
              const patch = edits[question.id] ?? {};
              const value = { ...question, ...patch };
              const dirty = Object.keys(patch).length > 0;
              const set = (change: Partial<Question>): void =>
                setEdits((current) => ({ ...current, [question.id]: { ...patch, ...change } }));

              const open = openId === question.id;

              return (
                <div key={question.id} className="rounded-md border border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : question.id)}
                    aria-expanded={open}
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-neutral-50"
                  >
                    {open ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-neutral-900">
                        <span className="mr-1.5 font-semibold text-neutral-500">
                          {question.number}.
                        </span>
                        {value.text}
                        {dirty ? (
                          <span className="ml-2 text-xs font-medium text-amber-700">sin guardar</span>
                        ) : null}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">
                          {question.key}
                        </code>
                        <Badge variant="outline">{question.type}</Badge>
                        {question.scope === 'mujer_adulta' ? (
                          <Badge variant="warning">solo mujeres ≥ 18</Badge>
                        ) : null}
                        {!value.active ? <Badge variant="outline">retirada</Badge> : null}
                        {question.locked ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-neutral-500"
                            title="Su definición se congeló porque ya tiene respuestas registradas."
                          >
                            <Lock className="h-3 w-3" aria-hidden />
                            {question.answerCount} respuesta{question.answerCount === 1 ? '' : 's'}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>

                  {!open ? null : (
                  <div className="space-y-3 border-t border-neutral-200 p-3">
                  <Field label="Enunciado">
                    <Textarea
                      value={value.text}
                      onChange={(event) => set({ text: event.target.value })}
                      maxLength={500}
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Ayuda (opcional)">
                      <Input
                        value={value.hint ?? ''}
                        onChange={(event) => set({ hint: event.target.value })}
                      />
                    </Field>
                    <Field label="Prompt del detalle (opcional)">
                      <Input
                        value={value.detailPrompt ?? ''}
                        onChange={(event) => set({ detailPrompt: event.target.value })}
                      />
                    </Field>
                  </div>

                  {question.options !== null ? (
                    question.locked ? (
                      <p className="text-xs text-neutral-500">
                        Opciones (congeladas): {question.options.join(' · ')}
                      </p>
                    ) : (
                      <Field label="Opciones" hint="Una por línea. Hacen falta al menos dos.">
                        <Textarea
                          rows={3}
                          value={(value.options ?? []).join('\n')}
                          onChange={(event) =>
                            set({
                              options: event.target.value
                                .split('\n')
                                .map((option) => option.trim())
                                .filter((option) => option !== ''),
                            })
                          }
                        />
                      </Field>
                    )
                  ) : null}

                  <div className="flex flex-wrap items-center gap-4">
                    <Checkbox
                      checked={value.required}
                      onChange={(event) => set({ required: event.target.checked })}
                      label="Obligatoria"
                    />
                    <Checkbox
                      checked={value.active}
                      onChange={(event) => set({ active: event.target.checked })}
                      label="Se muestra en el ingreso"
                    />
                    {dirty ? (
                      <Button size="sm" loading={save.pending} onClick={() => void handleSave(question)}>
                        <Save className="h-4 w-4" aria-hidden />
                        Guardar
                      </Button>
                    ) : null}
                    {!question.locked ? (
                      <ConfirmAction
                        label="Eliminar"
                        icon={<Trash2 className="h-4 w-4" aria-hidden />}
                        title={`Eliminar «${question.key}»`}
                        description="Nadie la ha respondido todavía, así que se borra sin dejar rastro. Si más adelante quiere recuperarla habrá que crearla de nuevo."
                        confirmLabel="Eliminar"
                        pending={remove.pending}
                        error={remove.error?.message ?? null}
                        onConfirm={() => {
                          void remove.run(question.id).then((result) => {
                            if (result !== null) questions.reload();
                          });
                        }}
                      />
                    ) : null}
                  </div>
                  </div>
                  )}
                </div>
              );
            })}
          </CardBody>
        </Card>
      ))}

      {save.error !== null ? (
        <Alert tone="danger" title="No se pudo guardar">
          {save.error.message}
        </Alert>
      ) : null}
    </div>
  );
}
