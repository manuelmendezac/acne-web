'use client';

import { ChevronRight, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { PageHeader } from '@/components/portal/page-header';
import { useSession } from '@/components/session-provider';
import { Badge, StudyModeBadge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/field';
import { EmptyState, ErrorState, Loading } from '@/components/ui/feedback';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import type { GetResult } from '@/lib/api';
import { date } from '@/lib/format';
import { useApi, useDebouncedValue } from '@/lib/use-api';
import { useCatalogs } from '@/lib/use-catalogs';
import { usePortalHref } from '@/lib/use-portal';

type CaseSummary = GetResult<'/cases'>[number];

const STATUS_VARIANT: Record<string, 'neutral' | 'primary' | 'success' | 'warning'> = {
  draft: 'neutral',
  in_review: 'warning',
  ai_processed: 'primary',
  diagnosed: 'primary',
  closed: 'success',
};

/** Bandeja de casos con filtro por modo de estudio (Sección 9.3). */
export default function CasosPage() {
  const href = usePortalHref();
  const { user } = useSession();
  const { data: catalogs } = useCatalogs();

  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [includeSynthetic, setIncludeSynthetic] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const cases = useApi<CaseSummary[]>('/cases', {
    status: status === '' ? undefined : status,
    pending: pending ? 'true' : undefined,
    includeSynthetic,
    search: debouncedSearch === '' ? undefined : debouncedSearch,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bandeja de casos"
        // The experimental framing only means something to whoever reads the evidence; the
        // consulting room and the desk get told what the tray is.
        description={
          user?.role === 'admin'
            ? 'Cada caso se mide dos veces: una sin la intervención (O₁) y otra con ella (O₂). Es su propio control.'
            : 'Casos abiertos y en seguimiento, del más reciente al más antiguo.'
        }
        actions={
          <Link href={href('/casos/nuevo')} className={buttonVariants({ variant: 'primary' })}>
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo caso
          </Link>
        }
      />

      <Card>
        <CardHeader title="Filtros" />
        <CardBody className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-64 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre del paciente o por código…"
              className="pl-9"
              aria-label="Buscar caso"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-neutral-500">Estado</span>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-48"
            >
              <option value="">Todos</option>
              {(catalogs?.caseStatuses.values ?? []).map((value) => (
                <option key={value} value={value}>
                  {catalogs?.caseStatuses.labels[value] ?? value}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pending}
              onChange={(event) => setPending(event.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-purple-900 focus:ring-purple-900"
            />
            <span>
              Solo los que faltan por revisar
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeSynthetic}
              onChange={(event) => setIncludeSynthetic(event.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-purple-900 focus:ring-purple-900"
            />
            Incluir casos sintéticos
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {/* Only blank the area on the FIRST load. A refetch triggered by typing keeps the
              previous rows on screen, so the list does not flash empty between keystrokes. */}
          {cases.loading && cases.data === null ? (
            <Loading label="Cargando casos…" />
          ) : cases.error !== null ? (
            <div className="p-5">
              <ErrorState message={cases.error.message} onRetry={cases.reload} />
            </div>
          ) : (cases.data ?? []).length === 0 ? (
            <EmptyState
              title="No hay casos que coincidan con el filtro"
              description="Registre un caso nuevo o ajuste los filtros."
            />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Caso</Th>
                  <Th>Paciente</Th>
                  <Th>Registrado en</Th>
                  <Th>Estado</Th>
                  <Th>Profesional</Th>
                  <Th numeric>Imágenes</Th>
                  <Th>Creado</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {(cases.data ?? []).map((item) => (
                  <Tr key={item.id}>
                    <Td>
                      <span className="font-mono text-sm font-medium text-neutral-900">
                        {item.caseCode}
                      </span>
                      {item.isSynthetic ? (
                        <Badge variant="outline" className="ml-2">
                          sintético
                        </Badge>
                      ) : null}
                    </Td>
                    <Td>
                      {item.patientName !== null ? (
                        <>
                          <span className="block text-sm text-neutral-900">
                            {item.patientName}
                          </span>
                          <span className="block font-mono text-xs text-neutral-500">
                            {item.patientCode}
                          </span>
                        </>
                      ) : (
                        <span className="font-mono text-xs text-neutral-500">
                          {item.patientCode}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <StudyModeBadge mode={item.studyMode} />
                    </Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[item.status] ?? 'neutral'}>
                        {catalogs?.caseStatuses.labels[item.status] ?? item.status}
                      </Badge>
                    </Td>
                    <Td className="text-sm">{item.assignedUserName ?? '—'}</Td>
                    <Td numeric>{item.imageCount}</Td>
                    <Td className="text-sm text-neutral-500">{date(item.createdAt)}</Td>
                    <Td>
                      <Link
                        href={href(`/casos/${item.id}`)}
                        className="flex items-center gap-1 text-sm font-medium text-purple-900 hover:underline"
                      >
                        Revisar
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
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
