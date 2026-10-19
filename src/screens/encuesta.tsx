"use client";

import { CheckCircle2, Download, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { Alert, Loading } from "@/components/ui/feedback";
import { api, type GetResult } from "@/lib/api";
import { cn } from "@/lib/cn";
import { num, pct } from "@/lib/format";
import { useAction, useApi } from "@/lib/use-api";
import { useCatalogs } from "@/lib/use-catalogs";

type SurveyStatus = GetResult<"/surveys/status">;
type SurveySummary = GetResult<"/surveys/summary">;

/**
 * Anexo 6 — Likert questionnaire (OE3).
 *
 * The item wording is rendered from `GET /meta/catalogs`, never hard-coded here: the instrument
 * was validated as written, so a paraphrase introduced in the UI would silently invalidate it.
 */
export default function EncuestaPage() {
  const { data: catalogs } = useCatalogs();
  const status = useApi<SurveyStatus>("/surveys/status");
  const summary = useApi<SurveySummary>("/surveys/summary", {
    includeSynthetic: true,
  });

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [comments, setComments] = useState("");

  const submit = useAction(async () =>
    api.post("/surveys", {
      answers: Object.entries(answers).map(([itemNumber, score]) => ({
        itemNumber: Number(itemNumber),
        score,
      })),
      comments: comments === "" ? undefined : comments,
    }),
  );

  const items = catalogs?.survey.items ?? [];
  const scale = catalogs?.survey.scale ?? {};
  const complete =
    items.length > 0 &&
    items.every((item) => answers[item.number] !== undefined);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!complete) return;
    const result = await submit.run();
    if (result !== null) {
      status.reload();
      summary.reload();
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cuestionario de satisfacción"
        description="Ocho afirmaciones sobre su experiencia con el sistema, en una escala de 1 a 5. Se responde una sola vez."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void api.download(
                "/reports/usabilidad/pdf?includeSynthetic=true",
                "REPORTE-USABILIDAD.pdf",
              )
            }
          >
            <Download className="h-4 w-4" aria-hidden />
            Reporte PDF
          </Button>
        }
      />

      {status.loading ? (
        <Loading />
      ) : status.data?.completed === true ? (
        <Alert tone="success" title="Ya respondió el cuestionario">
          El instrumento del Anexo 6 se aplica una única vez por profesional al
          final del postest.
        </Alert>
      ) : (
        <Card>
          <CardHeader
            title="Sus respuestas"
            description={
              status.data?.due === true
                ? "Ha alcanzado el umbral de casos postest configurado."
                : `Se activa automáticamente al completar ${status.data?.triggerThreshold ?? 10} casos en postest. Lleva ${status.data?.postestCasesCompleted ?? 0}.`
            }
          />
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-5">
              {items.map((item) => (
                <fieldset key={item.number} className="space-y-2">
                  <legend className="text-sm font-medium text-neutral-900">
                    {item.number}. {item.text}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((score) => {
                      const selected = answers[item.number] === score;
                      return (
                        <button
                          key={score}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setAnswers((current) => ({
                              ...current,
                              [item.number]: score,
                            }))
                          }
                          className={cn(
                            "flex min-w-24 flex-col items-center rounded-md border px-3 py-2 text-xs transition-colors",
                            selected
                              ? "border-purple-900 bg-purple-50 font-medium text-purple-900"
                              : "border-neutral-200 text-neutral-500 hover:border-purple-900/50 hover:bg-neutral-100",
                          )}
                        >
                          <span className="text-base font-semibold">
                            {score}
                          </span>
                          <span>{scale[String(score)] ?? ""}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-neutral-900">
                  Comentarios (opcional)
                </span>
                <Textarea
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                  placeholder="Observaciones sobre el uso del sistema…"
                />
              </label>

              {submit.error !== null ? (
                <Alert
                  tone="danger"
                  title="No se pudo registrar el cuestionario"
                >
                  {submit.error.message}
                </Alert>
              ) : null}

              <Button
                type="submit"
                block
                loading={submit.pending}
                disabled={!complete}
              >
                <Send className="h-4 w-4" aria-hidden />
                Enviar cuestionario
              </Button>
              {!complete ? (
                <p className="text-center text-xs text-neutral-500">
                  Responda los {items.length} ítems para poder enviar.
                </p>
              ) : null}
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Resultados agregados (TSP)"
          action={
            summary.data?.targetMet === null ||
            summary.data === null ? null : summary.data.targetMet ? (
              <Badge variant="success">
                <CheckCircle2 className="h-3 w-3" aria-hidden /> Cumple meta
              </Badge>
            ) : (
              <Badge variant="warning">No cumple</Badge>
            )
          }
        />
        <CardBody className="space-y-4">
          {summary.loading ? (
            <Loading />
          ) : summary.data === null || summary.data.respondents === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              Aún no hay respuestas.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Encuestados"
                  value={String(summary.data.respondents)}
                />
                <Metric label="TSP" value={pct(summary.data.tspPct)} />
                <Metric
                  label="Likert promedio"
                  value={`${num(summary.data.meanLikert)} / 5`}
                />
              </div>

              {summary.data.alert !== null ? (
                <Alert tone="warning">{summary.data.alert}</Alert>
              ) : null}

              <div className="space-y-3">
                {summary.data.items.map((item) => (
                  <div
                    key={item.itemNumber}
                    className="rounded-md border border-neutral-200 px-3 py-2"
                  >
                    <p className="text-sm text-neutral-900">
                      <span className="font-medium">{item.itemNumber}.</span>{" "}
                      {item.text}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-purple-900"
                          style={{ width: `${Math.round(item.tspPct)}%` }}
                        />
                      </div>
                      <span className="w-32 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                        {num(item.mean)} ± {num(item.sd)} · {pct(item.tspPct)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 px-3 py-2">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-neutral-900">
        {value}
      </p>
    </div>
  );
}
