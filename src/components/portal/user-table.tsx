'use client';

import { ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/field';
import { EmptyState, ErrorState, Loading } from '@/components/ui/feedback';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/table';
import type { GetResult } from '@/lib/api';
import { useApi, useDebouncedValue } from '@/lib/use-api';
import { useCatalogs } from '@/lib/use-catalogs';
import { usePortalHref } from '@/lib/use-portal';

export type StaffMember = GetResult<'/users'>[number];

/**
 * The staff list, shared by both maintainer screens.
 *
 * «Personal médico» and «Usuarios» are the same table over the same rows; what differs is which
 * roles they start from and how they are framed. Building one component and passing `roleScope`
 * is why the two cannot drift — a fix to the filters or the columns lands in both at once.
 */
export function UserTable({
  roleScope,
  hideRoleFilter = false,
  linkToDetail = true,
  rowAction,
  reloadKey = 0,
}: {
  roleScope?: readonly string[];
  /** Un filtro de rol con una sola opción es ruido: la sección ya dice de quién es la lista. */
  hideRoleFilter?: boolean;
  /** Falso donde no existe la ficha de usuario, como el portal del especialista. */
  linkToDetail?: boolean;
  rowAction?: (member: StaffMember) => ReactNode;
  /** Cámbielo para releer la lista, p. ej. tras dar de alta a alguien desde la misma pantalla. */
  reloadKey?: number;
}): JSX.Element {
  const href = usePortalHref();
  const { data: catalogs } = useCatalogs();

  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());

  // A scoped screen never asks for a role outside its scope, even when the selector says "all".
  const roleFilter = role === '' ? roleScope?.join(',') : role;

  const users = useApi<StaffMember[]>(
    '/users',
    {
      role: roleFilter,
      active: active === '' ? undefined : active,
      search: debouncedSearch === '' ? undefined : debouncedSearch,
    },
    [reloadKey],
  );

  const roleOptions = (roleScope ?? catalogs?.roles.values ?? []).filter((value) =>
    (catalogs?.roles.values ?? []).includes(value),
  );

  return (
    <>
      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre o correo…"
              aria-label="Buscar personal"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {hideRoleFilter ? null : (
            <Select
              className="w-52"
              aria-label="Filtrar por rol"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="">
                {roleScope === undefined ? 'Todos los roles' : 'Ambos roles'}
              </option>
              {roleOptions.map((value) => (
                <option key={value} value={value}>
                  {catalogs?.roles.labels[value] ?? value}
                </option>
              ))}
            </Select>
          )}

          <Select
            className="w-44"
            aria-label="Filtrar por estado"
            value={active}
            onChange={(event) => setActive(event.target.value)}
          >
            <option value="">Activos e inactivos</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
          </Select>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Personal registrado"
          description={
            users.data === null ? undefined : `${users.data.length} cuenta(s) en el listado.`
          }
        />
        <CardBody className="p-0">
          {/* Only blanked on the FIRST load: typing in the search box must not make the table
              flash empty between keystrokes. */}
          {users.loading && users.data === null ? (
            <Loading label="Cargando personal…" />
          ) : users.error !== null ? (
            <div className="p-5">
              <ErrorState message={users.error.message} onRetry={users.reload} />
            </div>
          ) : (users.data ?? []).length === 0 ? (
            <EmptyState
              title="No hay personal que coincida con el filtro"
              description="Ajuste la búsqueda o registre una cuenta nueva."
            />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  {/* «Condición» sobrevivió al retirar el modo de estudio y dejó SIETE
                      cabeceras sobre SEIS celdas: el consentimiento se pintaba bajo «Condición»,
                      el estado bajo «Consentimiento» y el enlace bajo «Estado». En su hueco va
                      ahora el teléfono, que es un dato que la tabla sí tiene. */}
                  <Th>Nombre</Th>
                  <Th>Rol</Th>
                  <Th>Especialidad</Th>
                  <Th>Teléfono</Th>
                  <Th>Consentimiento</Th>
                  <Th>Estado</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {(users.data ?? []).map((member) => (
                  <Tr key={member.id}>
                    <Td>
                      <p className="font-medium">
                        {member.fullName}
                        {/* Misma marca que lleva un caso de demostración en la bandeja: sin ella,
                            el censo de personal del estudio parecería tener cuatro personas más. */}
                        {member.isSynthetic ? (
                          <Badge variant="outline" className="ml-2">
                            sintético
                          </Badge>
                        ) : null}
                      </p>
                      <p className="font-mono text-xs text-neutral-500">
                        {member.email}
                      </p>
                    </Td>
                    <Td>
                      <Badge variant="neutral">
                        {catalogs?.roles.labels[member.role] ?? member.role}
                      </Badge>
                    </Td>
                    <Td className="text-neutral-500">
                      {member.specialty ?? '—'}
                    </Td>
                    <Td className="whitespace-nowrap text-neutral-500">
                      {member.phone ?? '—'}
                    </Td>
                    <Td>
                      {member.consentAcceptedAt === null ? (
                        <Badge variant="warning">Pendiente</Badge>
                      ) : (
                        <Badge variant="success">Firmado</Badge>
                      )}
                    </Td>
                    <Td>
                      {member.active ? (
                        <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="danger">Inactivo</Badge>
                      )}
                    </Td>
                    <Td>
                      <span className="flex items-center justify-end gap-2">
                        {rowAction?.(member)}
                        {linkToDetail ? (
                          <Link
                            href={href(`/usuarios/${member.id}`)}
                            className="flex items-center gap-1 text-sm font-medium text-purple-900 hover:underline"
                          >
                            Editar
                            <ChevronRight className="h-4 w-4" aria-hidden />
                          </Link>
                        ) : null}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </>
  );
}
