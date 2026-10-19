'use client';

import { ScrollText } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/field';
import { EmptyState, ErrorState, Loading } from '@/components/ui/feedback';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import type { GetResult } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { useCatalogs, type Catalogs } from '@/lib/use-catalogs';

type AuditLog = GetResult<'/audit/logs'>[number];
type ActionCount = GetResult<'/audit/logs/actions'>[number];

/**
 * The audit trail, read from the portal.
 *
 * `GET /audit/logs` existed from the first migration and no screen ever called it, so the evidence
 * RNF-02 asks for — «logs de auditoría por acceso a caso» — could only be produced by opening
 * PostgreSQL by hand. That is not evidence anyone can show at a defence.
 *
 * The trail is append-only: nothing here edits or deletes, and there is no endpoint that could.
 */
export function AuditTrail(): JSX.Element {
  const { data: catalogs } = useCatalogs();
  const [action, setAction] = useState('');
  const [limit, setLimit] = useState('100');

  const actions = useApi<ActionCount[]>('/audit/logs/actions');
  const logs = useApi<AuditLog[]>('/audit/logs', {
    action: action === '' ? undefined : action,
    limit,
  });

  const total = (actions.data ?? []).reduce((sum, entry) => sum + entry.count, 0);

  return (
    <Card>
      <CardHeader
        title="Traza de auditoría (RNF-02)"
        description="Registro append-only de cada escritura y de cada acceso a la identidad de un paciente. No se edita ni se borra."
        action={
          <span className="flex items-center gap-1.5 text-sm text-neutral-500">
            <ScrollText className="h-4 w-4" aria-hidden />
            {total} evento{total === 1 ? '' : 's'} · {(actions.data ?? []).length} acciones
          </span>
        }
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Select
            className="w-72"
            aria-label="Filtrar por acción"
            value={action}
            onChange={(event) => setAction(event.target.value)}
          >
            <option value="">Todas las acciones</option>
            {(actions.data ?? []).map((entry) => (
              <option key={entry.action} value={entry.action}>
                {entry.actionLabel} ({entry.count})
              </option>
            ))}
          </Select>

          <Select
            className="w-44"
            aria-label="Cuántos eventos mostrar"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
          >
            <option value="50">Últimos 50</option>
            <option value="100">Últimos 100</option>
            <option value="250">Últimos 250</option>
            <option value="500">Últimos 500</option>
          </Select>
        </div>

        {/* Only blanked on the FIRST load, so changing the filter does not flash the table empty. */}
        {logs.loading && logs.data === null ? (
          <Loading label="Cargando la traza…" />
        ) : logs.error !== null ? (
          <ErrorState message={logs.error.message} onRetry={logs.reload} />
        ) : (logs.data ?? []).length === 0 ? (
          <EmptyState
            title="No hay eventos con ese filtro"
            description="Elija otra acción o amplíe el número de eventos."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>Momento</Th>
                  <Th>Acción</Th>
                  <Th>Quién</Th>
                  <Th>Entidad</Th>
                  <Th>Detalle</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(logs.data ?? []).map((log) => (
                  <Tr key={log.id}>
                    <Td className="whitespace-nowrap text-neutral-500">
                      {dateTime(log.createdAt)}
                    </Td>
                    <Td>
                      {/* El nombre manda y el código queda a un tiro de ratón: un auditor cita el
                          código en un hallazgo, pero no debería tener que descifrarlo para leer la
                          tabla. */}
                      <span className="text-xs text-neutral-900" title={log.action}>
                        {log.actionLabel}
                      </span>
                    </Td>
                    <Td>
                      {log.userEmail === null ? (
                        // A mobile QR upload carries no principal; the trail attributes it to
                        // whoever opened the capture session so it never loses a responsible person.
                        <Badge variant="outline">sin sesión</Badge>
                      ) : (
                        <span className="text-xs">{log.userEmail}</span>
                      )}
                      {log.ipAddress === null ? null : (
                        <p className="font-mono text-xs text-neutral-500">
                          {log.ipAddress}
                        </p>
                      )}
                    </Td>
                    <Td>
                      <span className="text-xs text-neutral-500" title={log.entityType}>
                        {log.entityLabel}
                      </span>
                      {log.entityId === null ? null : (
                        <p className="font-mono text-xs text-neutral-500">
                          {log.entityId.slice(0, 8)}…
                        </p>
                      )}
                    </Td>
                    <Td className="max-w-md">
                      {log.metadata === null ? (
                        <span className="text-neutral-500">—</span>
                      ) : (
                        <code className="block break-words text-xs leading-relaxed">
                          {formatMetadata(log.metadata, catalogs)}
                        </code>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        )}

        <p className="text-xs text-neutral-500">
          El detalle nunca lleva el nombre ni el documento de un paciente: solo los campos que se
          tocaron. <code>registros_auditoria.metadatos</code> se guarda en claro, y volcar ahí la identidad
          metería el texto que RF-TR-03 cifra en la única tabla que nadie pensaría en cifrar.
        </p>
      </CardBody>
    </Card>
  );
}

/** Nombres de los campos que aparecen en el detalle de un evento. */
const METADATA_LABELS: Record<string, string> = {
  count: 'resultados',
  search: 'búsqueda',
  dataset: 'dataset',
  includeSynthetic: 'incluye sintéticos',
  hypothesis: 'hipótesis',
  testApplied: 'prueba aplicada',
  pValue: 'valor p',
  rejected: 'hipótesis rechazadas',
  total: 'hipótesis contrastadas',
  rejectsNull: 'rechaza H₀',
  studyMode: 'condición',
  caseId: 'caso',
  imageId: 'imagen',
  from: 'desde',
  to: 'hasta',
  fields: 'campos',
  reason: 'motivo',
  tspPct: 'TSP %',
  meanLikert: 'promedio Likert',
  t0: 't₀',
  t1: 't₁',
  report: 'reporte',
};

/**
 * El detalle del evento, en palabras.
 *
 * Era `JSON.stringify` a secas, de modo que la columna mostraba
 * `{"dataset":"anamnesis","includeSynthetic":true}` a quien audita. El contenido es genuinamente
 * sin esquema —por eso `metadatos` sigue siendo `jsonb`—, así que no se puede tipar; lo que sí se
 * puede es traducir las claves conocidas y presentar el resto como pares legibles en vez de como
 * una línea de JSON.
 */
function formatMetadata(
  metadata: Record<string, unknown>,
  catalogs: Catalogs | null,
): string {
  const entries = Object.entries(metadata).filter(([, value]) => value !== null && value !== '');
  if (entries.length === 0) return '—';

  return entries
    .map(([key, value]) => `${METADATA_LABELS[key] ?? key}: ${formatValue(key, value, catalogs)}`)
    .join(' · ');
}

function formatValue(key: string, value: unknown, catalogs: Catalogs | null): string {
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (Array.isArray(value)) return value.map((item) => formatValue(key, item, catalogs)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);

  // `ttest_rel` es el argumento con que se invocó SciPy y por eso se almacena así; el nombre de la
  // prueba lo sirve el catálogo, que es donde vive la redacción que se cita en la tesis.
  if (key === 'testApplied' && typeof value === 'string') {
    return catalogs?.hypotheses.testLabels[value] ?? value;
  }
  return String(value);
}
