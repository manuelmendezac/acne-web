'use client';

import { ChevronRight, Plus, Search, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useSession } from '@/components/session-provider';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { PageHeader } from '@/components/portal/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { EmptyState, ErrorState, Loading } from '@/components/ui/feedback';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import type { GetResult } from '@/lib/api';
import { date } from '@/lib/format';
import { useApi, useDebouncedValue } from '@/lib/use-api';
import { igaLabel, useCatalogs } from '@/lib/use-catalogs';
import { usePortalHref } from '@/lib/use-portal';

type PatientSummary = GetResult<'/patients'>[number];

/** Colour by severity, so a tray of patients can be triaged at a glance. */
const SEVERITY_VARIANT: Record<string, 'neutral' | 'success' | 'primary' | 'warning' | 'danger'> = {
  sin_lesiones: 'success',
  casi_sin_lesiones: 'success',
  leve: 'primary',
  moderado: 'warning',
  severo: 'danger',
};

/**
 * Patient registry.
 *
 * The case tray answers "what is left to review" for the experiment; this answers "who is this
 * person and how have they been doing", which is the question a follow-up consultation starts
 * from. The name is shown only to the roles in the `identity` group — for the rest the API
 * returns `fullName: null` and the row falls back to the anonymised code (RF-TR-03).
 */
export default function PacientesPage() {
  const href = usePortalHref();
  const { user } = useSession();
  const { data: catalogs } = useCatalogs();

  const [search, setSearch] = useState('');
  const [includeWithdrawn, setIncludeWithdrawn] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim());

  const patients = useApi<PatientSummary[]>('/patients', {
    search: debouncedSearch === '' ? undefined : debouncedSearch,
    includeWithdrawn: includeWithdrawn ? 'true' : undefined,
  });

  const rows = patients.data ?? [];
  const withFollowUp = rows.filter((patient) => patient.caseCount > 1).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pacientes"
        description="Registro clínico con el seguimiento de cada persona a lo largo de sus visitas."
        actions={
          <>
            {/* Registering a person and opening a visit are two different acts; the registry
                screen leads with the first. */}
            <Link
              href={href('/pacientes/nuevo')}
              className={buttonVariants({ variant: 'primary' })}
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Nuevo paciente
            </Link>
            <Link href={href('/casos/nuevo')} className={buttonVariants({ variant: 'outline' })}>
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo caso
            </Link>
          </>
        }
      />

      <Card>
        <CardHeader
          title="Búsqueda"
          description={
            (catalogs?.roles.groups.identity ?? []).includes(user?.role ?? '')
              ? 'Puede buscar por nombre o por código. Cada consulta del listado con identidad queda registrada en la auditoría.'
              : 'Su rol no accede a la identidad de los pacientes, así que la búsqueda opera sobre el código anonimizado.'
          }
          action={
            <span className="flex items-center gap-1.5 text-sm text-neutral-500">
              <Users className="h-4 w-4" aria-hidden />
              {rows.length} paciente{rows.length === 1 ? '' : 's'}
              {withFollowUp > 0 ? ` · ${withFollowUp} con seguimiento` : ''}
            </span>
          }
        />
        <CardBody className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-64 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o por código…"
              className="pl-9"
              aria-label="Buscar paciente"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeWithdrawn}
              onChange={(event) => setIncludeWithdrawn(event.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-purple-900 focus:ring-purple-900"
            />
            Incluir pacientes retirados del estudio
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {/* Only blank the area on the FIRST load, so typing does not flash the list empty. */}
          {patients.loading && patients.data === null ? (
            <Loading label="Cargando pacientes…" />
          ) : patients.error !== null ? (
            <div className="p-5">
              <ErrorState message={patients.error.message} onRetry={patients.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No hay pacientes que coincidan"
              description="Registre un caso nuevo o ajuste la búsqueda."
            />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Paciente</Th>
                  <Th>Edad</Th>
                  <Th>Sexo</Th>
                  <Th>Fototipo</Th>
                  <Th numeric>Visitas</Th>
                  <Th>Última visita</Th>
                  <Th>Severidad actual</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((patient) => (
                  <Tr key={patient.id}>
                    <Td>
                      {patient.fullName !== null ? (
                        <>
                          <span className="block text-sm font-medium text-neutral-900">
                            {patient.fullName}
                          </span>
                          <span className="block font-mono text-xs text-neutral-500">
                            {patient.patientCode}
                          </span>
                        </>
                      ) : (
                        <span className="font-mono text-sm text-neutral-900">
                          {patient.patientCode}
                        </span>
                      )}
                      {patient.withdrawnAt !== null ? (
                        <Badge variant="outline" className="mt-1">
                          retirado
                        </Badge>
                      ) : null}
                    </Td>
                    <Td className="text-sm">
                      {patient.ageYears === null ? '—' : `${patient.ageYears} años`}
                    </Td>
                    <Td className="text-sm capitalize">{patient.sex ?? '—'}</Td>
                    <Td className="text-sm">{patient.fitzpatrickPhototype ?? '—'}</Td>
                    <Td numeric>
                      {patient.caseCount}
                      {patient.caseCount > 1 ? (
                        <span className="ml-1 text-xs text-emerald-700">
                          seguimiento
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-sm text-neutral-500">
                      {date(patient.lastVisitAt)}
                    </Td>
                    <Td>
                      {patient.lastSeverity === null ? (
                        <span className="text-sm text-neutral-500">—</span>
                      ) : (
                        <Badge variant={SEVERITY_VARIANT[patient.lastSeverity] ?? 'neutral'}>
                          {igaLabel(catalogs, patient.lastSeverity)}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <Link
                        href={href(`/pacientes/${patient.id}`)}
                        className="flex items-center gap-1 text-sm font-medium text-purple-900 hover:underline"
                      >
                        Historia
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
