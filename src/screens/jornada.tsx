'use client';

import { Play, Square } from 'lucide-react';
import { useState } from 'react';

import { useSession } from '@/components/session-provider';
import { StudyModeBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/portal/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, EmptyState, Loading } from '@/components/ui/feedback';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import { api, type GetResult } from '@/lib/api';
import { dateTime, num } from '@/lib/format';
import { useAction, useApi } from '@/lib/use-api';
import { useCatalogs } from '@/lib/use-catalogs';

type WorkSession = GetResult<'/sessions'>[number];

/**
 * Work journey panel (OE4).
 *
 * The split of responsibilities is the instrument's, not a UI choice: NCR is counted by the
 * system as cases are closed, and TJ is declared by the professional here. Letting the system
 * infer TJ from wall-clock time would count coffee breaks and interruptions as diagnostic
 * capacity.
 */
export default function JornadaPage() {
  const { user } = useSession();
  const { data: catalogs } = useCatalogs();

  const [shift, setShift] = useState('manana');
  const [hours, setHours] = useState('6');

  const active = useApi<WorkSession | null>('/sessions/active');
  const history = useApi<WorkSession[]>('/sessions', { mine: true });

  const openSession = useAction(async () => api.post<WorkSession>('/sessions/open', { shift }));
  const closeSession = useAction(async () =>
    api.post<WorkSession>('/sessions/close', { declaredDurationHours: Number(hours) }),
  );

  function reloadAll(): void {
    active.reload();
    history.reload();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Jornada de trabajo"
        description="El sistema cuenta los casos revisados durante la jornada; usted declara su duración al cerrarla."
      />

      <Card>
        <CardHeader title={active.data != null ? 'Jornada en curso' : 'Abrir jornada'} />
        <CardBody className="space-y-4">
          {active.loading ? (
            <Loading />
          ) : active.data != null ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Inicio" value={dateTime(active.data.startedAt)} />
                <Metric
                  label="Turno"
                  value={catalogs?.workShifts.labels[active.data.shift] ?? active.data.shift}
                />
                <Metric label="Casos revisados (NCR)" value={String(active.data.casesReviewed)} />
              </div>

              <Field
                label="Duración declarada de la jornada (TJ), en horas"
                required
                hint="Tiempo efectivo dedicado a la revisión de casos, no el tiempo de reloj transcurrido."
              >
                <Input
                  type="number"
                  min={0.25}
                  max={24}
                  step={0.25}
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                  className="max-w-40"
                />
              </Field>

              {closeSession.error !== null ? (
                <Alert tone="danger">{closeSession.error.message}</Alert>
              ) : null}

              <Button
                variant="danger"
                loading={closeSession.pending}
                onClick={() => void closeSession.run().then(reloadAll)}
              >
                <Square className="h-4 w-4" aria-hidden />
                Cerrar jornada y congelar TCAD
              </Button>
            </>
          ) : (
            <>
              <Field label="Turno" required>
                <Select
                  value={shift}
                  onChange={(event) => setShift(event.target.value)}
                  className="max-w-60"
                >
                  {(catalogs?.workShifts.values ?? ['manana', 'tarde', 'noche']).map((value) => (
                    <option key={value} value={value}>
                      {catalogs?.workShifts.labels[value] ?? value}
                    </option>
                  ))}
                </Select>
              </Field>

              {openSession.error !== null ? (
                <Alert tone="danger">{openSession.error.message}</Alert>
              ) : null}

              <Button
                loading={openSession.pending}
                onClick={() => void openSession.run().then(reloadAll)}
              >
                <Play className="h-4 w-4" aria-hidden />
                Abrir jornada
              </Button>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Mis jornadas registradas" />
        <CardBody className="p-0">
          {history.loading ? (
            <Loading />
          ) : (history.data ?? []).length === 0 ? (
            <EmptyState title="Aún no ha registrado jornadas" />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Inicio</Th>
                  <Th>Condición</Th>
                  <Th>Turno</Th>
                  <Th numeric>NCR</Th>
                  <Th numeric>TJ (h)</Th>
                  <Th numeric>TCAD (casos/h)</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(history.data ?? []).map((session) => (
                  <Tr key={session.id}>
                    <Td className="text-sm">{dateTime(session.startedAt)}</Td>
                    <Td>
                      <StudyModeBadge mode={session.studyMode} />
                    </Td>
                    <Td className="text-sm">
                      {catalogs?.workShifts.labels[session.shift] ?? session.shift}
                    </Td>
                    <Td numeric>{session.casesReviewed}</Td>
                    <Td numeric>{num(session.declaredDurationHours)}</Td>
                    <Td numeric className="font-medium">
                      {num(session.tcad)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 px-3 py-2">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-base font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
