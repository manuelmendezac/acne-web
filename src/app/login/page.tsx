'use client';

import { CheckCircle2, ClipboardList, ScanFace, ShieldCheck } from 'lucide-react';
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
 * Left, a dark brand panel: the mark, what the product is, and a mock of a case file drawn with
 * the portal's own components — three protocol shots, the assisted evaluation, the attention map —
 * so the screen shows the job without a photograph of anyone. Right, the form in a card.
 *
 * The panel is `hidden lg:block`; below that breakpoint a dark band with the mark tops the form,
 * which is what matters on the phone a technician signs in from at the reception desk.
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
    <div className="grid min-h-screen lg:grid-cols-[11fr_9fr]">
      {/* --- Brand panel ---------------------------------------------------- */}
      <aside className="relative hidden overflow-hidden bg-neutral-950 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <DotField />
        <Glow />

        <div className="relative">
          <Wordmark size="lg" tone="dark" />
        </div>

        <div className="relative grid gap-12 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="max-w-md">
            <p className="text-xs font-medium uppercase tracking-widest text-purple-300">
              Consulta dermatológica
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
              {PRODUCT_TAGLINE}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              Del ingreso del paciente al diagnóstico firmado, en un solo flujo: protocolo
              fotográfico, anamnesis, evaluación asistida y receta.
            </p>

            <ul className="mt-8 space-y-4">
              <Feature
                icon={<ScanFace className="h-4 w-4" aria-hidden />}
                title="Protocolo fotográfico guiado"
                text="Vista general y ambos perfiles desde el teléfono, con cada toma validada al subirla."
              />
              <Feature
                icon={<ClipboardList className="h-4 w-4" aria-hidden />}
                title="Evaluación asistida, nunca automática"
                text="Clase IGA sugerida con su mapa de atención; el diagnóstico siempre lo firma el especialista."
              />
              <Feature
                icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
                title="Historia cifrada y auditada"
                text="Fotografías cifradas en reposo y cada acceso registrado, conforme a la Ley N.º 29733."
              />
            </ul>
          </div>

          <CaseMock />
        </div>

        <p className="relative text-xs text-neutral-500">
          Desarrollado en la {THESIS_INSTITUTION} · {THESIS_SCHOOL}
        </p>
      </aside>

      {/* --- Form ---------------------------------------------------------- */}
      <div className="flex flex-col bg-neutral-50">
        <header className="bg-neutral-950 px-6 py-4 lg:hidden">
          <Wordmark size="md" tone="dark" />
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-xs sm:p-10">
              <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">
                Acceso del personal
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
                Iniciar sesión
              </h1>
              <p className="mt-2 text-sm text-neutral-500">
                Ingrese con la cuenta que le asignó el centro. Cada rol entra a su propio portal.
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

              <p className="mt-6 border-t border-neutral-200 pt-5 text-xs leading-relaxed text-neutral-500">
                ¿No tiene cuenta o no recuerda su contraseña? El administrador del centro la crea o
                la restablece desde <span className="font-medium text-neutral-700">Usuarios</span>.
              </p>
            </div>

            <p className="mt-8 text-center text-xs text-neutral-500 lg:hidden">
              Desarrollado en la {THESIS_INSTITUTION} · {THESIS_SCHOOL}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-purple-300 ring-1 ring-inset ring-white/10">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-medium text-white">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-neutral-400">{text}</span>
      </span>
    </li>
  );
}

/**
 * A case file, as the portal draws one, with nothing real in it: a synthetic code, an outlined
 * face with the attention map over the cheek, the three protocol shots and the assisted reading.
 */
function CaseMock() {
  const classes: Array<[string, number, boolean]> = [
    ['Sin lesiones', 2, false],
    ['Casi sin lesiones', 9, false],
    ['Leve', 71, true],
    ['Moderado', 15, false],
    ['Severo', 3, false],
  ];
  return (
    <div
      aria-hidden
      className="w-80 shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/40 backdrop-blur-sm xl:translate-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-neutral-400">ACN-2026-0017</span>
        <span className="rounded-full bg-purple-400/15 px-2 py-0.5 text-xs font-medium text-purple-200 ring-1 ring-inset ring-purple-300/30">
          Fase postest
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_1.1fr] gap-3">
        <div className="relative aspect-3/4 overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-inset ring-white/10">
          <svg viewBox="0 0 120 160" className="h-full w-full">
            <ellipse cx="60" cy="78" rx="34" ry="46" fill="none" strokeWidth="2" className="stroke-neutral-600" />
            <path d="M26 78c0 26 15 48 34 48s34-22 34-48" fill="none" strokeWidth="2" className="stroke-neutral-700" />
            {/* Attention map over the right cheek: three rings, hottest in the middle. */}
            <circle cx="80" cy="92" r="20" className="fill-purple-500/20" />
            <circle cx="80" cy="92" r="12" className="fill-purple-400/35" />
            <circle cx="80" cy="92" r="5" className="fill-purple-300/80" />
            {/* The mark's grid, as the sampling the system works from. */}
            {[44, 60, 76].map((x) =>
              [62, 78, 94].map((y) => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" className="fill-neutral-500" />
              )),
            )}
          </svg>
          <span className="absolute inset-x-2 bottom-2 rounded-md bg-neutral-950/70 px-2 py-1 text-center text-xs text-neutral-300">
            Mapa de atención
          </span>
        </div>

        <div className="flex flex-col justify-between">
          <div>
            <p className="text-xs text-neutral-400">Evaluación asistida</p>
            <p className="mt-0.5 text-lg font-semibold text-white">Leve</p>
            <p className="text-xs text-neutral-400">Confianza 71 %</p>
          </div>
          <ul className="space-y-1.5">
            {classes.map(([label, value, lead]) => (
              <li key={label} className="flex items-center gap-2">
                <span className="w-24 truncate text-xs text-neutral-400">{label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className={lead ? 'block h-full rounded-full bg-purple-400' : 'block h-full rounded-full bg-neutral-600'}
                    style={{ width: `${value}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {['Vista general', 'Perfil derecho', 'Perfil izquierdo'].map((shot) => (
          <span
            key={shot}
            className="flex items-center justify-center gap-1 rounded-lg bg-white/5 px-2 py-1.5 text-xs text-neutral-300 ring-1 ring-inset ring-white/10"
          >
            <CheckCircle2 className="h-3 w-3 text-emerald-400" aria-hidden />
            <span className="truncate">{shot}</span>
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 ring-1 ring-inset ring-white/10">
        <span className="text-xs text-neutral-400">Acuerdo entre tomas</span>
        <span className="text-xs font-medium text-emerald-300">Unánime</span>
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
        <radialGradient id="dermatrix-fade" cx="20%" cy="25%" r="80%">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
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

/** A soft purple light behind the case mock, so the panel has depth without a gradient fill. */
function Glow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-purple-900/40 blur-3xl"
    />
  );
}
