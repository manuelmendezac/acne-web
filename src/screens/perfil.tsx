'use client';

import { CheckCircle2, Mail, ShieldCheck, Stethoscope } from 'lucide-react';

import { ChangePasswordCard } from '@/components/portal/change-password-card';
import { Avatar } from '@/components/portal/user-menu';
import { useSession } from '@/components/session-provider';
import { Badge, StudyModeBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert, ErrorState, Loading } from '@/components/ui/feedback';
import { api, type GetResult } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { USER_ROLE_LABELS } from '@/lib/roles';
import { useAction, useApi } from '@/lib/use-api';

type Profile = GetResult<'/users/me'>;

/**
 * The signed-in professional's own record.
 *
 * Reads `GET /users/me` rather than the cached session: the session is whatever the token said when
 * it was issued, and the study mode in particular can have moved since.
 *
 * It is also where the professional's informed consent is given. RNF-07 asks for electronic consent
 * from the patient AND from the medical staff; `POST /users/me/consent` existed from the start but
 * had no screen anywhere, so half of that requirement was unreachable.
 */
export default function PerfilPage() {
  const { refresh } = useSession();
  const profile = useApi<Profile>('/users/me');

  const acceptConsent = useAction(async () => {
    const updated = await api.post<Profile>('/users/me/consent');
    profile.reload();
    refresh();
    return updated;
  });

  if (profile.loading && profile.data === null) return <Loading label="Cargando su cuenta…" />;
  if (profile.error !== null) {
    return <ErrorState message={profile.error.message} onRetry={profile.reload} />;
  }
  if (profile.data === null) return null;

  const user = profile.data;
  const role = USER_ROLE_LABELS[user.role] ?? user.role;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={user.fullName} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-neutral-900">
            {user.fullName}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <span>{role}</span>
            {!user.active ? <Badge variant="danger">cuenta inactiva</Badge> : null}
          </p>
        </div>
      </header>

      <Card>
        <CardHeader title="Datos de la cuenta" />
        <CardBody>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Item icon={Mail} label="Correo electrónico" value={user.email} />
            <Item icon={ShieldCheck} label="Rol" value={role} />
            <Item
              icon={Stethoscope}
              label="Especialidad"
              value={user.specialty ?? 'No registrada'}
            />
            <Item icon={CheckCircle2} label="Cuenta creada" value={dateTime(user.createdAt)} />
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Cómo se registran sus mediciones"
          description="Todo lo que hace en el sistema es la observación O₂ del diseño."
        />
        <CardBody className="space-y-2 text-sm text-neutral-500">
          <p>
            El sistema <strong className="text-neutral-900">es</strong> la intervención X, de modo
            que cada revisión, diagnóstico y jornada que registra aquí cuenta como postest
            (IIA&nbsp;=&nbsp;1) y la evaluación asistida está siempre disponible.
          </p>
          <p>
            La observación O₁ es la evaluación <strong className="text-neutral-900">manual</strong>{' '}
            de la clínica, la que se hace sin este software. No ocurre aquí dentro: el administrador
            la transcribe desde el registro en papel, y contra ella se contrastan sus mediciones.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Consentimiento informado"
          description="Participación del personal médico en el estudio (RNF-07)."
          action={
            user.consentAcceptedAt === null ? (
              <Badge variant="warning">pendiente</Badge>
            ) : (
              <Badge variant="success">otorgado</Badge>
            )
          }
        />
        <CardBody className="space-y-3">
          {user.consentAcceptedAt === null ? (
            <>
              <p className="text-sm text-neutral-500">
                Declaro que participo voluntariamente en el estudio, que mis tiempos de revisión,
                diagnósticos y respuestas al cuestionario de satisfacción se registrarán de forma
                identificada para el análisis de los objetivos OE1 a OE4, y que puedo retirarme en
                cualquier momento sin consecuencia alguna.
              </p>
              {acceptConsent.error !== null ? (
                <Alert tone="danger">{acceptConsent.error.message}</Alert>
              ) : null}
              <Button loading={acceptConsent.pending} onClick={() => void acceptConsent.run()}>
                Otorgar mi consentimiento
              </Button>
            </>
          ) : (
            <Alert tone="success" title="Consentimiento registrado">
              Otorgado el {dateTime(user.consentAcceptedAt)}. Para retirarlo, comuníquelo al
              administrador del estudio.
            </Alert>
          )}
        </CardBody>
      </Card>

      <ChangePasswordCard />

      <p className="text-xs text-neutral-500">
        Para corregir su nombre, su correo o su rol, solicítelo al administrador del estudio.
      </p>
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-neutral-500">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-neutral-900">{value}</dd>
    </div>
  );
}
