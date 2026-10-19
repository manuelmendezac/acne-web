'use client';

import { ArrowLeft, Check, Copy, KeyRound, UserX } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { UserForm, type UserFormValues } from '@/components/portal/user-form';
import { useSession } from '@/components/session-provider';
import { Badge, StudyModeBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ConfirmAction } from '@/components/ui/confirm';
import { Alert, ErrorState, Loading } from '@/components/ui/feedback';
import { api, type GetResult, type PatchResult, type PostResult } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useApi, useAction } from '@/lib/use-api';
import { useCatalogs } from '@/lib/use-catalogs';
import { usePortalHref } from '@/lib/use-portal';

type StaffMember = GetResult<'/users/{id}'>;
type UpdatedUser = PatchResult<'/users/{id}'>;
type TemporaryPassword = PostResult<'/users/{id}/password-reset'>;

/** Detail and correction of one staff account. */
export default function UsuarioDetallePage(): JSX.Element {
  const href = usePortalHref();
  const params = useParams<{ id: string }>();
  const { user: session } = useSession();
  const { data: catalogs } = useCatalogs();
  const userId = params.id;

  const member = useApi<StaffMember>(`/users/${userId}`);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const save = useAction(async (values: UserFormValues) =>
    api.patch<UpdatedUser>(`/users/${userId}`, {
      fullName: values.fullName,
      email: values.email,
      role: values.role,
      specialty: values.specialty,
      phone: values.phone,
    }),
  );

  const setActive = useAction(async (active: boolean) =>
    api.patch<UpdatedUser>(`/users/${userId}`, { active }),
  );

  const resetPassword = useAction(async () =>
    api.post<TemporaryPassword>(`/users/${userId}/password-reset`),
  );

  if (member.loading && member.data === null) return <Loading label="Abriendo la cuenta…" />;
  if (member.error !== null) {
    return <ErrorState message={member.error.message} onRetry={member.reload} />;
  }
  if (member.data === null) return <></>;

  const staff = member.data;
  const isSelf = staff.id === session?.id;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href={href('/usuarios')}
        className="flex w-fit items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a usuarios
      </Link>

      <header>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          {staff.fullName}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <span className="font-mono text-xs">{staff.email}</span>
          <Badge variant="neutral">{catalogs?.roles.labels[staff.role] ?? staff.role}</Badge>
          {staff.active ? (
            <Badge variant="success">Activo</Badge>
          ) : (
            <Badge variant="danger">Inactivo</Badge>
          )}
          {isSelf ? <Badge variant="outline">Su cuenta</Badge> : null}
        </p>
      </header>

      <Card>
        <CardHeader title="Datos de la cuenta" />
        <CardBody>
          <UserForm
            mode="edit"
            submitLabel="Guardar cambios"
            lockRole={isSelf}
            initial={{
              fullName: staff.fullName,
              email: staff.email,
              role: staff.role,
              specialty: staff.specialty ?? '',
              phone: staff.phone ?? '',
            }}
            pending={save.pending}
            error={save.error}
            onSubmit={(values) => {
              void save.run(values).then((updated) => {
                if (updated !== null) member.reload();
              });
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Contraseña"
          description="Genera una contraseña nueva y la muestra una sola vez."
        />
        <CardBody className="space-y-3">
          {temporaryPassword === null ? (
            <ConfirmAction
              label="Restablecer contraseña"
              icon={<KeyRound className="h-4 w-4" aria-hidden />}
              tone="warning"
              title="Se generará una contraseña nueva"
              confirmLabel="Generar contraseña"
              pending={resetPassword.pending}
              error={resetPassword.error?.message ?? null}
              description={
                <>
                  La contraseña actual dejará de funcionar de inmediato y la nueva se mostrará{' '}
                  <strong>una sola vez</strong>. Anótela antes de salir de esta pantalla.
                  <br />
                  No cierra las sesiones abiertas: quien ya tenga un token de refresco seguirá
                  entrando hasta que caduque.
                </>
              }
              onConfirm={() => {
                void resetPassword.run().then((result) => {
                  if (result !== null) {
                    setTemporaryPassword(result.password);
                    setCopied(false);
                  }
                });
              }}
            />
          ) : (
            // Persistent, never a toast: a password that fades after four seconds is a trap.
            <Alert tone="success" title="Contraseña generada">
              <p className="mb-2">
                Entréguesela a {staff.fullName}. No volverá a mostrarse en ninguna pantalla.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded border border-emerald-300 bg-white px-3 py-1.5 font-mono text-sm">
                  {temporaryPassword}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(temporaryPassword).then(() => setCopied(true));
                  }}
                >
                  {copied ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                  {copied ? 'Copiada' : 'Copiar'}
                </Button>
              </div>
            </Alert>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Estado de la cuenta" />
        <CardBody className="space-y-3">
          {isSelf ? (
            <Alert tone="info">
              No puede desactivar su propia cuenta. Pídaselo a otro administrador.
            </Alert>
          ) : staff.active ? (
            <ConfirmAction
              label="Desactivar cuenta"
              icon={<UserX className="h-4 w-4" aria-hidden />}
              title="La cuenta dejará de poder entrar"
              confirmLabel="Desactivar"
              pending={setActive.pending}
              error={setActive.error?.message ?? null}
              description={
                <>
                  No se borra nada: la cuenta queda inactiva y sus diagnósticos, cronometrajes y
                  jornadas siguen sosteniendo los indicadores del estudio.
                  <br />
                  <strong>No cierra la sesión que ya tenga abierta.</strong> Seguirá trabajando
                  hasta que caduque su token de acceso o intente renovarlo.
                </>
              }
              onConfirm={() => {
                void setActive.run(false).then(() => member.reload());
              }}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-neutral-500">
                La cuenta está desactivada y no puede iniciar sesión.
              </p>
              <Button
                size="sm"
                loading={setActive.pending}
                onClick={() => {
                  void setActive.run(true).then(() => member.reload());
                }}
              >
                Reactivar cuenta
              </Button>
              {setActive.error !== null ? (
                <Alert tone="danger">{setActive.error.message}</Alert>
              ) : null}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Consentimiento" />
        <CardBody className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-neutral-500">
              Consentimiento informado (RNF-07):
            </span>
            {staff.consentAcceptedAt === null ? (
              <Badge variant="warning">Pendiente de firmar</Badge>
            ) : (
              <span>{dateTime(staff.consentAcceptedAt)}</span>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
