'use client';

import { Camera, Check, Clock, Loader2, ShieldCheck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { Alert, Loading } from '@/components/ui/feedback';
import { ApiError, api, type GetResult, type PostResult } from '@/lib/api';
import { cn } from '@/lib/cn';

type CaptureContext = GetResult<'/capture/{token}'>;
type UploadResult = PostResult<'/capture/{token}/images'>;
type Shot = CaptureContext['shots'][number];

/**
 * Photograph capture from the patient's or technician's phone.
 *
 * **Why a file input and not `getUserMedia`.** Browsers only expose the camera API in a secure
 * context: HTTPS, or `localhost`. At the clinic this page is opened over the local network as
 * `http://192.168.x.x:3000`, which is not a secure context, so an in-page camera preview would fail
 * on every phone — the exact device the feature exists for. `<input capture>` hands the job to the
 * phone's own camera app, needs no permission API, and returns a full-resolution photograph with
 * the native autofocus and flash, which for a clinical close-up is better than a cropped `<video>`
 * frame anyway. The framing guidance moves from an on-screen overlay to a line of text per shot.
 *
 * The page shows the case CODE and never the patient's name: the route is public, authorised by the
 * token in the URL alone (RF-TR-03).
 */
export default function CapturaMovilPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [context, setContext] = useState<CaptureContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(0);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [justSent, setJustSent] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.getPath<CaptureContext>(`/capture/${token}`);
      setContext(result);
      setError(null);
    } catch (caught) {
      setContext(null);
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'No se pudo contactar con el centro. Revise su conexión.',
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (context === null) return;
    const expiresAt = new Date(context.expiresAt).getTime();
    const tick = (): void =>
      setRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [context]);

  const send = async (file: File, shot: Shot): Promise<void> => {
    setUploading(shot.key);
    setUploadError(null);
    setUploadWarnings([]);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('shotKey', shot.key);
      const result = await api.upload<UploadResult>(`/capture/${token}/images`, form);
      // The photograph was accepted; these say what to do better next time. Shown while the patient
      // is still in front of the camera, which is the only moment they are worth anything.
      setUploadWarnings(result.warnings ?? []);
      setJustSent(shot.key);
      await load();
    } catch (caught) {
      setUploadError(
        caught instanceof ApiError ? caught.message : 'No se pudo enviar la fotografía.',
      );
    } finally {
      setUploading(null);
    }
  };

  if (loading) return <Loading label="Abriendo el envío…" />;

  if (context === null) {
    return (
      <Alert tone="danger" title="Este enlace ya no sirve">
        <p>{error ?? 'El código caducó o fue anulado.'}</p>
        <p className="mt-2">Genere un código QR nuevo desde la ficha del caso.</p>
      </Alert>
    );
  }

  if (remaining <= 0) {
    return (
      <Alert tone="warning" title="El código caducó">
        Pida al personal del centro que genere uno nuevo y vuelva a escanearlo.
      </Alert>
    );
  }

  const full = context.uploadCount >= context.maxUploads;
  // The three views the case cannot be evaluated without, still to be taken.
  const pendingRequired = context.shots.filter((shot) => shot.required && shot.uploaded === 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-2">
          <p className="text-sm text-neutral-500">Caso</p>
          <p className="font-mono text-lg font-semibold text-neutral-900">
            {context.caseCode}
          </p>
          <p className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Caduca en {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </span>
            <span>
              {context.uploadCount} de {context.maxUploads} fotografías
            </span>
          </p>
        </CardBody>
      </Card>

      {pendingRequired.length > 0 ? (
        <Alert
          tone="info"
          title={`Faltan ${pendingRequired.length} fotografías obligatorias`}
        >
          {pendingRequired.map((shot) => shot.label).join(', ')}. Sin ellas el especialista no
          puede evaluar el caso. Todas deben ser del mismo paciente, con solo él en la foto.
        </Alert>
      ) : (
        <Alert tone="success" title="Fotografías obligatorias completas">
          Puede añadir las tomas opcionales que el profesional le haya indicado.
        </Alert>
      )}

      {full ? (
        <Alert tone="warning" title="Alcanzó el máximo de fotografías">
          Si necesita enviar más, pida al centro un código nuevo.
        </Alert>
      ) : null}

      {uploadError !== null ? <Alert tone="danger">{uploadError}</Alert> : null}

      {uploadWarnings.length > 0 ? (
        <Alert tone="warning" title="La fotografía se guardó, pero podría salir mejor">
          <ul className="space-y-1">
            {uploadWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <ul className="space-y-3">
        {context.shots.map((shot) => (
          <ShotCard
            key={shot.key}
            shot={shot}
            disabled={full || uploading !== null}
            uploading={uploading === shot.key}
            justSent={justSent === shot.key}
            onFile={(file) => void send(file, shot)}
          />
        ))}
      </ul>

      <p className="flex items-start gap-2 text-xs text-neutral-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Las fotografías se cifran al guardarse y solo las ve el profesional que atiende el caso. Cada
        envío queda registrado en la auditoría.
      </p>
    </div>
  );
}

function ShotCard({
  shot,
  disabled,
  uploading,
  justSent,
  onFile,
}: {
  shot: Shot;
  disabled: boolean;
  uploading: boolean;
  justSent: boolean;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const done = shot.uploaded > 0;

  return (
    <li
      className={cn(
        'rounded-lg border bg-white p-4',
        done
          ? 'border-emerald-600/40'
          : 'border-neutral-200',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900">
            {shot.label}
            {shot.required ? <Badge variant="outline">obligatoria</Badge> : null}
          </p>
          <p className="mt-1 text-sm text-neutral-500">{shot.instruction}</p>
        </div>
        {done ? (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Check className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className={cn(
          'mt-3 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-60',
          done
            ? 'border border-neutral-200 text-neutral-500'
            : 'bg-purple-900 text-white',
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Enviando…
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" aria-hidden />
            {done ? 'Tomar otra' : 'Tomar foto'}
          </>
        )}
      </button>

      {justSent && !uploading ? (
        <p className="mt-2 text-center text-xs text-emerald-700">
          Enviada al centro.
        </p>
      ) : null}

      {/*
        `capture="environment"` opens the phone's rear camera through its own camera app. Unlike
        `getUserMedia` it needs no secure context, which is what makes this work over the clinic's
        plain-HTTP local network.
      */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) onFile(file);
          event.target.value = '';
        }}
      />
    </li>
  );
}
