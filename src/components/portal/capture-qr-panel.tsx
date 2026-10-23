'use client';

import {
  Check,
  ImagePlus,
  Monitor,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert, Loading } from '@/components/ui/feedback';
import { api, type GetResult, type PostResult } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAction, usePolledApi } from '@/lib/use-api';
import { missingRequiredShots, shotLabel } from '@/lib/shots';
import { useCatalogs } from '@/lib/use-catalogs';

type CaptureSession = PostResult<'/capture-sessions'>;
export type CaseImage = GetResult<'/images/case/{caseId}'>[number];
type UploadResult = PostResult<'/images/case/{caseId}'>;
type Shot = { key: string; label: string; instruction: string; required: boolean };

/**
 * Hands the phone a case, as a QR code, and watches the photographs arrive.
 *
 * The protocol is drawn as a board of tiles, one per shot, so the desk sees at a glance which views
 * are in and which are still missing; the photograph lands on its own tile as the phone sends it,
 * and a file dropped on an empty tile is uploaded under that view. The QR is a side column: the
 * photographs are the content, the code is only the way to take them.
 *
 * Two facts about the environment shape the QR column:
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
  embedded = false,
}: {
  caseId: string;
  caseCode: string;
  /** The clinical photographs as they stand, so the screen can gate the analysis on the protocol. */
  onImagesChanged?: (images: CaseImage[]) => void;
  /** Render the body only, for a screen that supplies its own card and heading (the intake). */
  embedded?: boolean;
}) {
  const { data: catalogs } = useCatalogs();
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(1);
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
    setSessionSeconds(
      Math.max(1, Math.floor((new Date(created.expiresAt).getTime() - Date.now()) / 1000)),
    );
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

  // Which shot the hidden file input is about to upload: set by the tile that was clicked.
  const [pendingShot, setPendingShot] = useState<string | null>(null);
  const pickFileFor = (shotKey: string): void => {
    setPendingShot(shotKey);
    fileInput.current?.click();
  };

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

  const [preview, setPreview] = useState<CaseImage | null>(null);

  const shots: Shot[] = useMemo(() => catalogs?.shots?.definitions ?? [], [catalogs]);
  const required = useMemo(() => shots.filter((shot) => shot.required), [shots]);
  const optional = useMemo(() => shots.filter((shot) => !shot.required), [shots]);

  // The tile shows the newest photograph of its view: a retake supersedes the one that came out
  // blurred. Older ones, and photographs with no view, are listed under the board.
  const latestFor = useCallback(
    (key: string): CaseImage | null =>
      [...clinical]
        .filter((image) => image.shotKey === key)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    [clinical],
  );
  const leftovers = useMemo(() => {
    const shown = new Set(shots.map((shot) => latestFor(shot.key)?.id));
    return clinical.filter((image) => !shown.has(image.id));
  }, [clinical, shots, latestFor]);

  const missing = useMemo(() => missingRequiredShots(clinical, shots), [clinical, shots]);
  const requiredDone = required.length - missing.length;
  const complete = images.data !== null && required.length > 0 && missing.length === 0;

  const imageUrl = (image: CaseImage): string => api.url(image.url.replace(/^\/api/, ''));

  const tileProps = {
    caseCode,
    shots,
    uploading: uploadFromDesktop.pending ? pendingShot : null,
    relabelPending: relabel.pending,
    removePending: removeImage.pending,
    confirming,
    imageUrl,
    onPick: pickFileFor,
    onDrop: (shotKey: string, file: File) => void uploadFromDesktop.run(file, shotKey),
    onRelabel: (imageId: string, shotKey: string) => void relabel.run(imageId, shotKey),
    onAskRemove: setConfirming,
    onRemove: (imageId: string) => void removeImage.run(imageId),
    onPreview: setPreview,
  };

  const body = (
    <div className={cn('grid gap-6 lg:grid-cols-[1fr_17rem]', embedded && 'px-6 py-5')}>
      {/* --- Board --------------------------------------------------------- */}
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ProtocolMeter done={requiredDone} total={required.length} complete={complete} />
            <p className="text-sm">
              <span className="font-medium text-neutral-900">
                {complete
                  ? 'Protocolo completo'
                  : `${requiredDone} de ${required.length} tomas obligatorias`}
              </span>
              <span className="block text-xs text-neutral-500">
                {complete
                  ? 'El caso tiene la vista general y los dos perfiles.'
                  : 'Vista general y ambos perfiles; sin ellas el caso no se puede analizar.'}
              </span>
            </p>
          </div>
          <Badge variant={clinical.length > 0 ? 'success' : 'outline'}>
            {clinical.length} {clinical.length === 1 ? 'fotografía' : 'fotografías'}
          </Badge>
        </div>

        {images.data === null && images.loading ? (
          <Loading label="Cargando las fotografías…" />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {required.map((shot) => (
                <ShotTile key={shot.key} shot={shot} image={latestFor(shot.key)} {...tileProps} />
              ))}
            </ul>

            {optional.length > 0 ? (
              <details className="group rounded-lg border border-neutral-200" open={optional.some((s) => latestFor(s.key) !== null)}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="font-medium text-neutral-900">
                    Tomas adicionales
                    <span className="ml-2 font-normal text-neutral-500">
                      {optional.filter((s) => latestFor(s.key) !== null).length} de {optional.length}
                    </span>
                  </span>
                  <span className="text-xs text-neutral-500 group-open:hidden">Mostrar</span>
                  <span className="hidden text-xs text-neutral-500 group-open:inline">Ocultar</span>
                </summary>
                <ul className="grid grid-cols-3 gap-3 border-t border-neutral-200 p-4 sm:grid-cols-5">
                  {optional.map((shot) => (
                    <ShotTile
                      key={shot.key}
                      shot={shot}
                      image={latestFor(shot.key)}
                      compact
                      {...tileProps}
                    />
                  ))}
                </ul>
              </details>
            ) : null}

            {leftovers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-900">
                  Otras fotografías
                  <span className="ml-2 text-xs font-normal text-neutral-500">
                    Tomas repetidas o sin vista asignada. Asigne la vista correcta o quítelas.
                  </span>
                </p>
                <ul className="flex flex-wrap gap-3">
                  {leftovers.map((image) => (
                    <li key={image.id} className="w-28 space-y-1.5">
                      <Thumb
                        image={image}
                        alt={`Fotografía ${image.shotKey ?? 'sin vista'} del caso ${caseCode}`}
                        src={imageUrl(image)}
                        confirming={confirming === image.id}
                        removePending={removeImage.pending}
                        onAskRemove={() => setConfirming(image.id)}
                        onCancelRemove={() => setConfirming(null)}
                        onRemove={() => void removeImage.run(image.id)}
                        onPreview={() => setPreview(image)}
                        className="aspect-3/4"
                      />
                      <ShotSelect
                        image={image}
                        shots={shots}
                        disabled={relabel.pending}
                        onRelabel={(key) => void relabel.run(image.id, key)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}

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
          <Alert tone="danger" title="No se pudo subir la fotografía">
            {uploadFromDesktop.error.message}
          </Alert>
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
          <Alert tone="danger" title="No se pudo cambiar la vista">
            {relabel.error.message}
          </Alert>
        ) : null}
      </div>

      {/* --- Sources ------------------------------------------------------- */}
      <div className="space-y-3">
        <SourceBox icon={<Smartphone className="h-4 w-4" aria-hidden />} title="Desde el teléfono">
          {session === null ? (
            <>
              <p className="text-xs text-neutral-500">
                Genere un código y escanéelo con la cámara del teléfono. El enlace dura 15 minutos y
                cada fotografía aparece aquí al instante.
              </p>
              <Button block loading={openSession.pending} onClick={() => void openSession.run()}>
                <QrCode className="h-4 w-4" aria-hidden />
                Generar código QR
              </Button>
              {openSession.error !== null ? (
                <Alert tone="danger">{openSession.error.message}</Alert>
              ) : null}
            </>
          ) : remaining <= 0 ? (
            <>
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
            </>
          ) : qrDataUrl === null ? (
            <Loading label="Generando el código…" />
          ) : (
            <>
              <div className="rounded-lg border border-neutral-200 bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`Código QR para enviar fotografías del caso ${caseCode}`}
                  className="mx-auto w-full max-w-52"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">Caduca en</span>
                  <span className="font-medium tabular-nums text-neutral-900">
                    {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      remaining < 60 ? 'bg-amber-500' : 'bg-purple-900',
                    )}
                    style={{ width: `${Math.min(100, (remaining / sessionSeconds) * 100)}%` }}
                  />
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Esperando fotografías del teléfono
              </p>
              {isLoopback ? (
                <Alert tone="warning" title="El teléfono no podrá abrir este enlace">
                  Está entrando por <code>{origin}</code>, que en el teléfono apunta al propio
                  teléfono. Sirva el portal en la dirección de red del equipo (por ejemplo{' '}
                  <code>http://192.168.1.50:3000</code>) y vuelva a entrar por esa URL.
                </Alert>
              ) : null}
            </>
          )}
        </SourceBox>

        <SourceBox icon={<Monitor className="h-4 w-4" aria-hidden />} title="Desde este equipo">
          <p className="text-xs text-neutral-500">
            Arrastre la imagen sobre la toma que corresponde o pulse <strong>Subir</strong> en
            ella. La fotografía queda rotulada con esa vista; si una quedó mal rotulada, cámbiela
            desde su miniatura.
          </p>
        </SourceBox>
      </div>

      {preview !== null ? (
        <Lightbox
          src={imageUrl(preview)}
          caption={`${shotLabel(shots, preview.shotKey)} · ${caseCode}`}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );

  if (embedded) return body;

  return (
    <Card>
      <CardHeader
        title="Fotografías clínicas"
        description="Tome las fotos con el teléfono escaneando el código, o súbalas desde este equipo."
      />
      <CardBody>{body}</CardBody>
    </Card>
  );
}

// --- Pieces ------------------------------------------------------------------

/** Three segments, one per required view: a glance says how far the protocol is. */
function ProtocolMeter({
  done,
  total,
  complete,
}: {
  done: number;
  total: number;
  complete: boolean;
}) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        complete ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500',
      )}
      aria-hidden
    >
      {complete ? (
        <Check className="h-4 w-4" />
      ) : (
        <span className="flex gap-0.5">
          {Array.from({ length: Math.max(total, 1) }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-3 w-1 rounded-full',
                i < done ? 'bg-purple-900' : 'bg-neutral-300',
              )}
            />
          ))}
        </span>
      )}
    </span>
  );
}

function SourceBox({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <span className="text-neutral-500">{icon}</span>
        {title}
      </p>
      {children}
    </div>
  );
}

/**
 * One view of the protocol. Empty, it is a drop target with the silhouette of the view it wants;
 * filled, it shows the photograph with its controls.
 */
function ShotTile({
  shot,
  image,
  compact = false,
  caseCode,
  shots,
  uploading,
  relabelPending,
  removePending,
  confirming,
  imageUrl,
  onPick,
  onDrop,
  onRelabel,
  onAskRemove,
  onRemove,
  onPreview,
}: {
  shot: Shot;
  image: CaseImage | null;
  compact?: boolean;
  caseCode: string;
  shots: readonly Shot[];
  uploading: string | null;
  relabelPending: boolean;
  removePending: boolean;
  confirming: string | null;
  imageUrl: (image: CaseImage) => string;
  onPick: (shotKey: string) => void;
  onDrop: (shotKey: string, file: File) => void;
  onRelabel: (imageId: string, shotKey: string) => void;
  onAskRemove: (imageId: string | null) => void;
  onRemove: (imageId: string) => void;
  onPreview: (image: CaseImage) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const busy = uploading === shot.key;

  const dropHandlers = {
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (file !== undefined && file.type.startsWith('image/')) onDrop(shot.key, file);
    },
  };

  return (
    <li className="min-w-0 space-y-2">
      {image === null ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onPick(shot.key)}
          {...dropHandlers}
          className={cn(
            'group flex aspect-3/4 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors',
            dragging
              ? 'border-purple-900 bg-purple-50'
              : 'border-neutral-300 bg-neutral-50 hover:border-purple-900 hover:bg-purple-50/40',
            busy && 'cursor-wait',
          )}
          aria-label={`Subir ${shot.label}`}
        >
          <ViewSilhouette shotKey={shot.key} className={compact ? 'h-10 w-10' : 'h-16 w-16'} />
          {busy ? (
            <span className="text-xs text-neutral-500">Subiendo…</span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-neutral-500 group-hover:text-purple-900">
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
              {compact ? 'Subir' : 'Subir o arrastrar'}
            </span>
          )}
        </button>
      ) : (
        <Thumb
          image={image}
          src={imageUrl(image)}
          alt={`${shot.label} del caso ${caseCode}`}
          confirming={confirming === image.id}
          removePending={removePending}
          onAskRemove={() => onAskRemove(image.id)}
          onCancelRemove={() => onAskRemove(null)}
          onRemove={() => onRemove(image.id)}
          onPreview={() => onPreview(image)}
          className="aspect-3/4"
          {...dropHandlers}
          dragging={dragging}
        />
      )}

      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
          {image !== null ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Tomada" />
          ) : null}
          <span className="truncate">{shot.label}</span>
          {shot.required && !compact ? (
            <span className="shrink-0 text-xs font-normal text-neutral-500">obligatoria</span>
          ) : null}
        </p>
        {!compact ? <p className="text-xs text-neutral-500">{shot.instruction}</p> : null}
      </div>

      {image !== null ? (
        <div className={cn('flex gap-1.5', compact && 'flex-col')}>
          <Button
            variant="outline"
            size="sm"
            loading={busy}
            disabled={uploading !== null}
            onClick={() => onPick(shot.key)}
            className="shrink-0"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden />
            Repetir
          </Button>
          {!compact ? (
            <ShotSelect
              image={image}
              shots={shots}
              disabled={relabelPending}
              onRelabel={(key) => onRelabel(image.id, key)}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** A photograph with its hover controls: enlarge, and remove with an inline confirmation. */
function Thumb({
  image,
  src,
  alt,
  confirming,
  removePending,
  onAskRemove,
  onCancelRemove,
  onRemove,
  onPreview,
  className,
  dragging = false,
  ...drop
}: {
  image: CaseImage;
  src: string;
  alt: string;
  confirming: boolean;
  removePending: boolean;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onRemove: () => void;
  onPreview: () => void;
  className?: string;
  dragging?: boolean;
  onDragOver?: (event: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (event: React.DragEvent) => void;
}) {
  return (
    <div
      {...drop}
      className={cn(
        'group relative w-full overflow-hidden rounded-lg bg-neutral-900 ring-1 ring-inset transition-shadow',
        dragging ? 'ring-2 ring-purple-900' : 'ring-black/10',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full object-cover" />

      {confirming ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950/85 p-2 text-center">
          <span className="text-xs font-medium text-white">¿Quitar esta fotografía?</span>
          <span className="flex gap-1.5">
            <button
              type="button"
              disabled={removePending}
              onClick={onRemove}
              className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              Quitar
            </button>
            <button
              type="button"
              onClick={onCancelRemove}
              className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-neutral-900 hover:bg-neutral-100"
            >
              No
            </button>
          </span>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onPreview}
            aria-label={`Ampliar: ${alt}`}
            className="absolute inset-0 flex items-end bg-linear-to-t from-neutral-950/60 to-transparent p-2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          >
            <span className="flex items-center gap-1 text-xs font-medium text-white">
              <ZoomIn className="h-3.5 w-3.5" aria-hidden />
              Ampliar
            </span>
          </button>
          <button
            type="button"
            aria-label={`Quitar: ${alt}`}
            onClick={onAskRemove}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950/60 text-white opacity-0 transition-opacity hover:bg-red-600 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
          {image.width !== null && image.height !== null ? (
            <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-neutral-950/60 px-1.5 py-0.5 text-xs tabular-nums text-white opacity-0 transition-opacity group-hover:opacity-100">
              {image.width}×{image.height}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

function ShotSelect({
  image,
  shots,
  disabled,
  onRelabel,
}: {
  image: CaseImage;
  shots: readonly Shot[];
  disabled: boolean;
  onRelabel: (shotKey: string) => void;
}) {
  return (
    <select
      aria-label="Vista de esta fotografía"
      value={image.shotKey ?? ''}
      disabled={disabled}
      onChange={(event) => {
        if (event.target.value !== '') onRelabel(event.target.value);
      }}
      className={cn(
        'h-8 w-full min-w-0 rounded-md border bg-white px-2 text-xs focus:border-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-900/20',
        image.shotKey === null
          ? 'border-amber-400 text-amber-700'
          : 'border-neutral-300 text-neutral-700',
      )}
    >
      {image.shotKey === null ? <option value="">Sin vista</option> : null}
      {shots.map((shot) => (
        <option key={shot.key} value={shot.key}>
          {shot.label}
        </option>
      ))}
    </select>
  );
}

/**
 * The outline of the view a tile is waiting for: a face from the front, or turned to one side.
 * The profiles follow the rule the API checks (`EXPECTED_PROFILE_POSE` in `shot-view.ts`): for
 * `perfil_derecho` the patient turns to their left, so with the rear camera the nose points to the
 * RIGHT edge of the image (`nariz_derecha`); `perfil_izquierdo` is the mirror. The path below is
 * drawn nose-left, hence the flip on the right profile. A silhouette that disagreed with the check
 * would teach the technician to trigger the «other side» warning.
 */
function ViewSilhouette({ shotKey, className }: { shotKey: string; className?: string }) {
  const stroke = 'stroke-neutral-400 group-hover:stroke-purple-900';
  if (shotKey === 'general') {
    return (
      <svg viewBox="0 0 64 64" fill="none" strokeWidth="2" className={cn(stroke, className)} aria-hidden>
        <ellipse cx="32" cy="26" rx="13" ry="16" />
        <path d="M10 60c2-11 10-17 22-17s20 6 22 17" />
      </svg>
    );
  }
  if (shotKey === 'perfil_derecho' || shotKey === 'perfil_izquierdo') {
    return (
      <svg
        viewBox="0 0 64 64"
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
        className={cn(stroke, className, shotKey === 'perfil_derecho' && '-scale-x-100')}
        aria-hidden
      >
        <path d="M40 10c-9 0-16 7-16 17 0 3-2 5-4 7l3 1v4l2 1 1 4c0 2 2 3 5 3h2v6" />
        <path d="M40 10c8 0 12 7 12 14 0 9-5 15-10 18" />
        <path d="M12 60c2-10 8-15 21-17" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" fill="none" strokeWidth="2" className={cn(stroke, className)} aria-hidden>
      <rect x="10" y="18" width="44" height="32" rx="4" />
      <circle cx="32" cy="34" r="8" />
      <path d="M24 18l3-6h10l3 6" />
    </svg>
  );
}

/** The photograph at full size, over the page. Escape or a click outside closes it. */
function Lightbox({
  src,
  caption,
  onClose,
}: {
  src: string;
  caption: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={caption}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-neutral-950/90 p-6"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={caption}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
      />
      <p className="text-sm text-neutral-300">{caption}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
