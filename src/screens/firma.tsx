'use client';

import { PenLine, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/portal/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ConfirmAction } from '@/components/ui/confirm';
import { Alert, EmptyState, ErrorState, Loading } from '@/components/ui/feedback';
import { api, type GetResult } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/use-api';

type Signature = GetResult<'/signatures/me'>;

/** 512 kB, el mismo tope que aplica el servidor. */
const MAX_BYTES = 512 * 1024;

/**
 * La rúbrica que se imprime en cada receta.
 *
 * La pantalla dice con todas las letras lo que NO es: una firma electrónica reconocida legalmente.
 * Es la rúbrica que el paciente espera ver, y lo que detecta una receta alterada es el SHA-256 que
 * el sistema guarda al emitirla. Confundir ambas cosas en la defensa sería un problema, así que el
 * aviso está a la vista y no en una nota al pie.
 */
export default function FirmaPage(): JSX.Element {
  const signature = useApi<Signature>('/signatures/me');
  const fileInput = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const upload = useAction(async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return api.upload('/signatures/me', body);
  });
  const remove = useAction(async () => api.post('/signatures/me/remove', {}));

  async function handleFile(file: File | undefined): Promise<void> {
    setLocalError(null);
    if (file === undefined) return;
    if (file.size > MAX_BYTES) {
      setLocalError(`La imagen pesa ${Math.round(file.size / 1024)} kB y el tope son 512 kB.`);
      return;
    }
    const result = await upload.run(file);
    if (result === null) return;
    signature.reload();
  }

  if (signature.loading && signature.data === null) return <Loading label="Cargando su firma…" />;
  if (signature.error !== null) {
    return <ErrorState message={signature.error.message} onRetry={signature.reload} />;
  }

  const has = signature.data?.hasSignature === true && signature.data.imageUrl !== null;

  return (
    <div className="space-y-5">
      <PageHeader title="Firma" description="Se imprime en cada receta que usted emite." />

      <Alert tone="warning" title="No es una firma electrónica reconocida">
        Es la rúbrica que el paciente espera ver impresa. Lo que permite detectar una receta
        alterada es la huella SHA-256 que el sistema calcula al emitirla, no esta imagen.
      </Alert>

      <Card>
        <CardHeader
          title="Su rúbrica"
          description="PNG o JPEG, hasta 512 kB. Se guarda cifrada, como las imágenes clínicas."
        />
        <CardBody className="space-y-4">
          {has ? (
            <div className="rounded-md border border-neutral-200 bg-white p-4">
              {/*
                * URL firmada por el servidor, igual que las fotografías clínicas: una etiqueta
                * `<img>` no puede adjuntar la cabecera Authorization, así que una ruta protegida
                * por rol devolvía 401 y el navegador pintaba una imagen rota.
                */}
              {/* eslint-disable-next-line @next/next/no-img-element -- la sirve la API, no el
                  optimizador de imágenes de Next. */}
              <img
                src={api.url(signature.data?.imageUrl ?? '')}
                alt="Su firma registrada"
                className="mx-auto max-h-32 max-w-full object-contain"
              />
              {signature.data?.updatedAt !== null && signature.data?.updatedAt !== undefined ? (
                <p className="mt-3 text-center text-xs text-neutral-500">
                  Registrada el {dateTime(signature.data.updatedAt)}
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="Todavía no ha registrado su firma"
              description="Suba una imagen de su rúbrica sobre fondo claro. Se imprimirá al pie de cada receta."
            />
          )}

          {localError !== null ? (
            <Alert tone="danger" title="No se pudo usar el archivo">
              {localError}
            </Alert>
          ) : null}
          {upload.error !== null ? (
            <Alert tone="danger" title="No se pudo subir">
              {upload.error.message}
            </Alert>
          ) : null}

          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />

          <div className="flex flex-wrap gap-2">
            <Button loading={upload.pending} onClick={() => fileInput.current?.click()}>
              {has ? <PenLine className="h-4 w-4" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
              {has ? 'Reemplazar firma' : 'Subir firma'}
            </Button>

            {has ? (
              <ConfirmAction
                label="Retirar"
                title="Retirar su firma"
                description="Las recetas ya emitidas conservan la firma con que salieron; las nuevas se imprimirán sin rúbrica hasta que registre otra."
                confirmLabel="Retirar"
                pending={remove.pending}
                error={remove.error?.message ?? null}
                onConfirm={() => {
                  void remove.run().then((result) => {
                    if (result !== null) signature.reload();
                  });
                }}
              />
            ) : null}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
