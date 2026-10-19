'use client';

import { Check, QrCode, RefreshCw, Smartphone, Trash2, Upload } from 'lucide-react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert, Loading } from '@/components/ui/feedback';
import { api, type GetResult, type PostResult } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAction, usePolledApi } from '@/lib/use-api';
import { listShotLabels, missingRequiredShots } from '@/lib/shots';
import { useCatalogs } from '@/lib/use-catalogs';

type CaptureSession = PostResult<'/capture-sessions'>;
export type CaseImage = GetResult<'/images/case/{caseId}'>[number];
type UploadResult = PostResult<'/images/case/{caseId}'>;

/**
 * Hands the phone a case, as a QR code, and watches the photographs arrive.
 *
 * Two facts about the environment shape this panel:
 *
 *  - **The phone cannot resolve `localhost`.** The QR encodes `window.location.origin`, which is the
 *    only address known to actually have reached the user. When that origin is a loopback address
 *    the code would be unscannable in practice, so the panel says so instead of showing a QR that
 *    silently fails on the phone.
 *  - **The session is short-lived and capped** (RNF-02). The countdown is shown because a
 *    receptionist who scans an expired code gets an error on the phone with no way to tell why.
 */
export function CaptureQrPanel({
  caseId,
  caseCode,
  onImagesChanged,
}: {
  caseId: string;
  caseCode: string;
  /** The clinical photographs as they stand, so the screen can gate the analysis on the protocol. */
  onImagesChanged?: (images: CaseImage[]) => void;
}) {
  const { data: catalogs } = useCatalogs();
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  // Poll while a session is open so the desktop shows each photograph as the phone sends it.
  const images = usePolledApi<CaseImage[]>(
    `/images/case/${caseId}`,
    undefined,
    session !== null && remaining > 0 ? 3000 : 0,
  );

  const clinical = useMemo(
    () => (images.data ?? []).filter((image) => !image.isHeatmap),
    [images.data],
  );

  useEffect(() => {
    onImagesChanged?.(clinical);
  }, [clinical, onImagesChanged]);

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(origin);
  const mobileUrl = session === null ? null : `${origin}/captura/${session.token}`;

  const openSession = useAction(async () => {
    const created = await api.post<CaptureSession>('/capture-sessions', { caseId });
    setSession(created);
    return created;
  });

  // Regenerate the code whenever the session changes; the token only exists in memory.
  useEffect(() => {
    if (mobileUrl === null) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(mobileUrl, { width: 320, margin: 1, errorCorrectionLevel: 'M' }).then(
      (url) => {
        if (!cancelled) setQrDataUrl(url);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [mobileUrl]);

  useEffect(() => {
    if (session === null) return;
    const expiresAt = new Date(session.expiresAt).getTime();
    const tick = (): void =>
      setRemaining(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session]);

  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);

  const uploadFromDesktop = useAction(async (file: File, shotKey: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('shotKey', shotKey);
    setUploadWarnings([]);
    const result = await api.upload<UploadResult>(`/images/case/${caseId}`, form);
    // The photograph was accepted; these say what would make the next one better.
    setUploadWarnings(result.warnings ?? []);
    images.reload();
    return result;
  });

  // Which shot the hidden file input is about to upload: set by the "Subir" button of a row.
  const [pendingShot, setPendingShot] = useState<string | null>(null);

  const relabel = useAction(async (imageId: string, shotKey: string) => {
    const result = await api.post(`/images/${imageId}/shot`, { shotKey });
    images.reload();
    return result;
  });

  /**
   * Quitar una fotografía subida por error.
   *
   * Se pide confirmación en la propia miniatura y no con un diálogo: son bytes que ya viajaron al
   * servidor y el clic de más evita el descuido, sin sacar a nadie de la pantalla. El servidor se
   * niega cuando la imagen ya sustenta algo —una inferencia, un diagnóstico firmado— y ese mensaje
   * se muestra tal cual, que es donde se explica por qué.
   */
  const [confirming, setConfirming] = useState<string | null>(null);
  const removeImage = useAction(async (imageId: string) => {
    const result = await api.post(`/images/${imageId}/remove`, {});
    setConfirming(null);
    images.reload();
    return result;
  });

  const shots = useMemo(() => catalogs?.shots?.definitions ?? [], [catalogs]);
  const uploadedFor = useCallback(
    (key: string) => clinical.filter((image) => image.shotKey === key).length,
    [clinical],
  );
  const missing = useMemo(() => missingRequiredShots(clinical, shots), [clinical, shots]);

  return (
    <Card>
      <CardHeader
        title="Fotografías clínicas"
        description="Tome las fotos con el teléfono escaneando el código, o súbalas desde este equipo."
        action={
          <Badge variant={clinical.length > 0 ? 'success' : 'outline'}>
            {clinical.length} {clinical.length === 1 ? 'imagen' : 'imágenes'}
          </Badge>
        }
      />
      <CardBody className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          {session === null ? (
            <div className="space-y-3">
              <p className="text-sm text-neutral-500">
                Genere un código QR y escanéelo con el teléfono para tomar las fotografías del
                paciente. El enlace caduca a los 15 minutos.
              </p>
              <Button
                block
                loading={openSession.pending}
                onClick={() => void openSession.run()}
              >
                <QrCode className="h-4 w-4" aria-hidden />
                Generar código QR
              </Button>
              {openSession.error !== null ? (
                <Alert tone="danger">{openSession.error.message}</Alert>
              ) : null}
            </div>
          ) : remaining <= 0 ? (
            <div className="space-y-3">
              <Alert tone="warning" title="El código caducó">
                Genere uno nuevo para seguir enviando fotografías desde el teléfono.
              </Alert>
              <Button
                block
                variant="outline"
                loading={openSession.pending}
                onClick={() => void openSession.run()}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Generar otro código
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {qrDataUrl === null ? (
                <Loading label="Generando el código…" />
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt={`Código QR para enviar fotografías del caso ${caseCode}`}
                    className="mx-auto w-full max-w-64 rounded-md border border-neutral-200 bg-white p-2"
                  />
                  <p className="flex items-center justify-center gap-1.5 text-sm text-neutral-500">
                    <Smartphone className="h-4 w-4" aria-hidden />
                    Escanee con la cámara del teléfono
                  </p>
                  <p className="text-center text-xs tabular-nums text-neutral-500">
                    Caduca en {Math.floor(remaining / 60)}:
                    {String(remaining % 60).padStart(2, '0')}
                  </p>
                </>
              )}

              {isLoopback ? (
                <Alert tone="warning" title="El teléfono no podrá abrir este enlace">
                  Está entrando por <code>{origin}</code>, que en el teléfono apunta al propio
                  teléfono. Sirva el portal en la dirección de red del equipo (por ejemplo{' '}
                  <code>http://192.168.1.50:3000</code>) y vuelva a entrar por esa URL.
                </Alert>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {images.data !== undefined && missing.length > 0 ? (
            <Alert tone="warning" title="Faltan tomas obligatorias">
              {listShotLabels(missing)}. Sin ellas el caso no se puede analizar ni diagnosticar.
            </Alert>
          ) : null}
          {images.data !== undefined && missing.length === 0 && clinical.length > 0 ? (
            <Alert tone="success" title="Protocolo fotográfico completo">
              El caso tiene la vista general y los dos perfiles.
            </Alert>
          ) : null}
          <ul className="space-y-2">
            {shots.map((shot) => {
              const count = uploadedFor(shot.key);
              return (
                <li
                  key={shot.key}
                  className={cn(
                    'flex items-start gap-3 rounded-md border px-3 py-2',
                    count > 0
                      ? 'border-emerald-600/40'
                      : 'border-neutral-200',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs',
                      count > 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-neutral-100 text-neutral-500',
                    )}
                  >
                    {count > 0 ? <Check className="h-3 w-3" aria-hidden /> : '·'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900">
                      {shot.label}
                      {shot.required ? <Badge variant="outline">obligatoria</Badge> : null}
                      {count > 1 ? (
                        <span className="text-xs text-neutral-500">×{count}</span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {shot.instruction}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={uploadFromDesktop.pending && pendingShot === shot.key}
                    disabled={uploadFromDesktop.pending}
                    onClick={() => {
                      setPendingShot(shot.key);
                      fileInput.current?.click();
                    }}
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                    {count > 0 ? 'Otra' : 'Subir'}
                  </Button>
                </li>
              );
            })}
          </ul>

          <p className="border-t border-neutral-200 pt-3 text-xs text-neutral-500">
            Desde este equipo, use <strong>Subir</strong> en la fila de la toma que corresponde: la
            fotografía queda rotulada con esa vista. Si una quedó mal rotulada, cámbiela debajo de
            su miniatura.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              const shot = pendingShot;
              if (file !== undefined && shot !== null) void uploadFromDesktop.run(file, shot);
              event.target.value = '';
            }}
          />
          {uploadFromDesktop.error !== null ? (
            <Alert tone="danger">{uploadFromDesktop.error.message}</Alert>
          ) : null}

          {uploadWarnings.length > 0 ? (
            <Alert tone="warning" title="La fotografía se guardó, pero podría salir mejor">
              <ul className="space-y-1">
                {uploadWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {removeImage.error !== null ? (
            <Alert tone="danger" title="No se pudo quitar la fotografía">
              {removeImage.error.message}
            </Alert>
          ) : null}
          {relabel.error !== null ? (
            <Alert tone="danger" title="No se pudo cambiar la toma">
              {relabel.error.message}
            </Alert>
          ) : null}

          {clinical.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {clinical.map((image) => (
                <div key={image.id} className="flex w-24 flex-col gap-1">
                <div
                  className="group relative h-20 w-24 overflow-hidden rounded-md border border-neutral-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={api.url(image.url.replace(/^\/api/, ''))}
                    alt={`Fotografía ${image.shotKey ?? 'clínica'} del caso ${caseCode}`}
                    className="h-full w-full object-cover"
                  />

                  {confirming === image.id ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral-900/80 p-1">
                      <span className="text-xs font-medium text-white">¿Quitarla?</span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          disabled={removeImage.pending}
                          onClick={() => void removeImage.run(image.id)}
                          className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-neutral-900 hover:bg-neutral-100"
                        >
                          No
                        </button>
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Quitar la fotografía ${image.shotKey ?? 'clínica'}`}
                      onClick={() => setConfirming(image.id)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/70 text-white opacity-0 transition-opacity hover:bg-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </div>
                <select
                  aria-label="Toma de esta fotografía"
                  value={image.shotKey ?? ''}
                  disabled={relabel.pending}
                  onChange={(event) => {
                    if (event.target.value !== '') void relabel.run(image.id, event.target.value);
                  }}
                  className={cn(
                    'w-full rounded-md border bg-white px-1 py-0.5 text-xs',
                    image.shotKey === null
                      ? 'border-amber-400 text-amber-700'
                      : 'border-neutral-200 text-neutral-700',
                  )}
                >
                  {image.shotKey === null ? <option value="">Sin toma</option> : null}
                  {shots.map((shot) => (
                    <option key={shot.key} value={shot.key}>
                      {shot.label}
                    </option>
                  ))}
                </select>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
