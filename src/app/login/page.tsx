'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { useSession } from '@/components/session-provider';
import { Button } from '@/components/ui/button';
import { LabelledInput, PasswordInput } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { login } from '@/lib/api';
import { PRODUCT_TAGLINE, THESIS_INSTITUTION, THESIS_SCHOOL } from '@/lib/constants';
import { portalForRole, portalHref } from '@/lib/portals';
import { useAction } from '@/lib/use-api';

/**
 * Sign-in: the product's front door.
 *
 * A dark brand panel on the left and the form on the right. The panel is `hidden lg:block`; below
 * that breakpoint the form takes the full width, which is what matters on the phone a technician
 * signs in from at the reception desk.
 */
export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { run, pending, error } = useAction(login);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const session = await run(email.trim(), password);
    if (session !== null) {
      setSession(session);
      // Each role has exactly one portal, so there is nothing to choose here.
      const portal = portalForRole(session.user.role);
      router.push(portal === null ? '/login' : portalHref(portal.slug));
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[5fr_7fr]">
      {/* --- Brand panel ---------------------------------------------------- */}
      <aside className="relative hidden overflow-hidden bg-neutral-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <DotField />
        <div className="relative">
          <Wordmark size="lg" tone="dark" />
        </div>
        <div className="relative max-w-md">
          <p className="text-2xl font-semibold leading-snug text-white">{PRODUCT_TAGLINE}</p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            Registro del paciente, fotografías del protocolo, evaluación asistida y diagnóstico del
            especialista en un solo flujo de consulta.
          </p>
        </div>
        <p className="relative text-xs text-neutral-500">
          Desarrollado en la {THESIS_INSTITUTION} · {THESIS_SCHOOL}
        </p>
      </aside>

      {/* --- Form ---------------------------------------------------------- */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <header className="lg:hidden">
          <Wordmark size="md" />
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Iniciar sesión
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              Ingrese con la cuenta que le asignó el centro.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              <LabelledInput
                label="Correo electrónico"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@centro.pe"
              />
              <PasswordInput
                label="Contraseña"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              {error !== null ? (
                <Alert tone="danger" title="No se pudo iniciar sesión">
                  {error.message}
                </Alert>
              ) : null}

              <Button type="submit" block size="lg" loading={pending}>
                Entrar
              </Button>
            </form>

            <p className="mt-10 text-xs text-neutral-500 lg:hidden">
              Desarrollado en la {THESIS_INSTITUTION} · {THESIS_SCHOOL}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A quiet field of dots behind the brand panel: the mark's grid, extended. */
function DotField() {
  return (
    <svg className="absolute inset-0 h-full w-full text-purple-900" aria-hidden>
      <defs>
        <pattern id="dermatrix-dots" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" fill="currentColor" />
        </pattern>
        <radialGradient id="dermatrix-fade" cx="20%" cy="30%" r="80%">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="dermatrix-mask">
          <rect width="100%" height="100%" fill="url(#dermatrix-fade)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#dermatrix-dots)" mask="url(#dermatrix-mask)" />
    </svg>
  );
}
