'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/portal/page-header';
import { UserTable } from '@/components/portal/user-table';
import { buttonVariants } from '@/components/ui/button-variants';
import { usePortalHref } from '@/lib/use-portal';

/**
 * Maintainer for every account in the study, the intake desk included.
 *
 * `GET`, `POST` and `PATCH /users` existed from the first day of the project and were called from
 * nowhere in the portal — the same way the medical staff's own consent endpoint had no screen until
 * `/portal/perfil` was built. This is where they finally become reachable.
 */
export default function UsuariosPage(): JSX.Element {
  const href = usePortalHref();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuarios"
        description="Todo el personal del estudio: quien diagnostica, quien recibe al paciente, quien analiza y quien administra."
        actions={
          <Link href={href('/usuarios/nuevo')} className={buttonVariants({ variant: 'primary' })}>
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo usuario
          </Link>
        }
      />

      <UserTable />
    </div>
  );
}
