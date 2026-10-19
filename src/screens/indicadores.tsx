"use client";

import { Download, RefreshCw } from "lucide-react";
import { useState } from "react";

import { BoxPlot } from "@/components/charts/box-plot";
import { ComparisonBar } from "@/components/charts/comparison-bar";
import { ConfusionMatrix } from "@/components/charts/confusion-matrix";
import { IndicatorCard } from "@/components/portal/indicator-card";
import { PageHeader } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, ErrorState, Loading } from "@/components/ui/feedback";
import { api, type GetResult } from "@/lib/api";
import { num, pct } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { useCatalogs } from "@/lib/use-catalogs";

// Derived from the backend's OpenAPI document, never redeclared by hand (Sección 4).
type Dashboard = GetResult<"/indicators/dashboard">;
type ClassificationReport = GetResult<"/indicators/classification/{studyMode}">;

/** Covers: RF-OE1-03, RF-OE2-03, RF-OE2-04, RF-OE3-03, RF-OE4-02, RF-OE4-04. */
export default function IndicadoresPage() {
  const [includeSynthetic, setIncludeSynthetic] = useState(true);
  const query = { includeSynthetic };

  const { data: catalogs } = useCatalogs();
  const dashboard = useApi<Dashboard>("/indicators/dashboard", query);
  const classification = useApi<ClassificationReport>(
    "/indicators/classification/postest",
    query,
  );

  if (dashboard.loading) return <Loading label="Calculando indicadores…" />;
  if (dashboard.error !== null) {
    return (
      <ErrorState
        message={dashboard.error.message}
        onRetry={dashboard.reload}
      />
    );
  }

  const indicators = dashboard.data?.indicators ?? [];
  const trm = indicators.find((i) => i.indicator === "TRM");
  const tcad = indicators.find((i) => i.indicator === "TCAD");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Indicadores de la variable dependiente"
        description="TRM · TPD · TSP · TCAD, comparados entre las condiciones O₁ (pretest, sin IA) y O₂ (postest, con IA)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={dashboard.reload}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Recalcular
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void api.download(
                  `/reports/indicadores/pdf?includeSynthetic=${includeSynthetic}`,
                  "REPORTE-INDICADORES.pdf",
                )
              }
            >
              <Download className="h-4 w-4" aria-hidden />
              Reporte PDF
            </Button>
          </div>
        }
      />

      <label className="flex w-fit items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={includeSynthetic}
          onChange={(event) => setIncludeSynthetic(event.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 text-purple-900 focus:ring-purple-900"
        />
        Incluir datos sintéticos de demostración
      </label>

      {includeSynthetic ? (
        <Alert tone="warning" title="Se están mostrando datos sintéticos">
          Las cifras incluyen los 30 casos generados por <code>seed:study</code>
          . Sirven para demostrar el sistema, pero{" "}
          <strong>no constituyen evidencia de la tesis</strong>. Desmarque la
          casilla para ver únicamente mediciones reales.
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {indicators.map((indicator) => (
          <IndicatorCard key={indicator.indicator} data={indicator} />
        ))}
      </section>

      <Card>
        <CardHeader
          title="Comparativa por condición"
          description="Valor del indicador en cada condición experimental."
        />
        <CardBody className="grid gap-8 lg:grid-cols-2">
          {indicators
            .filter((i) => i.pretest !== null || i.postest !== null)
            .map((indicator) => (
              <div key={indicator.indicator}>
                <p className="mb-2 text-sm font-medium text-neutral-900">
                  {indicator.indicator} — {indicator.definition.name}{" "}
                  <span className="text-neutral-500">
                    ({indicator.definition.unit})
                  </span>
                </p>
                <ComparisonBar
                  unit={indicator.definition.unit}
                  data={[
                    ...(indicator.pretest !== null
                      ? [
                          {
                            label: "Pretest",
                            value: indicator.pretest.value,
                            condition: "pretest" as const,
                          },
                        ]
                      : []),
                    ...(indicator.postest !== null
                      ? [
                          {
                            label: "Postest",
                            value: indicator.postest.value,
                            condition: "postest" as const,
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            ))}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Distribución del tiempo de revisión (OE1)"
            description="Diagrama de caja de TRᵢ por condición."
          />
          <CardBody>
            <BoxPlot
              unit="min/caso"
              series={[
                {
                  label: "Pretest",
                  values: trm?.pretest?.observations ?? [],
                  colorClass: "text-neutral-500",
                },
                {
                  label: "Postest",
                  values: trm?.postest?.observations ?? [],
                  colorClass: "text-purple-900",
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Distribución de la capacidad de atención (OE4)"
            description="Diagrama de caja de TCAD por jornada y condición (RF-OE4-04)."
          />
          <CardBody>
            <BoxPlot
              unit="casos/hora"
              series={[
                {
                  label: "Pretest",
                  values: tcad?.pretest?.observations ?? [],
                  colorClass: "text-neutral-500",
                },
                {
                  label: "Postest",
                  values: tcad?.postest?.observations ?? [],
                  colorClass: "text-purple-900",
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Precisión diagnóstica en postest (RF-OE2-04)"
          description="Matriz de confusión y métricas por clase IGA."
        />
        <CardBody className="space-y-5">
          {classification.loading ? (
            <Loading />
          ) : classification.error !== null ? (
            <ErrorState
              message={classification.error.message}
              onRetry={classification.reload}
            />
          ) : classification.data === null ||
            classification.data.total === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              Todavía no hay casos con patrón de referencia y predicción de la
              IA.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat
                  label="Exactitud (TPD)"
                  value={pct(classification.data.accuracyPct)}
                />
                <Stat
                  label="Aciertos"
                  value={`${classification.data.correct} / ${classification.data.total}`}
                />
                <Stat
                  label="F1 macro"
                  value={num(classification.data.f1Macro, 3)}
                />
                <Stat
                  label="AUC-ROC macro"
                  value={
                    classification.data.aucRocMacro === null
                      ? "—"
                      : num(classification.data.aucRocMacro, 3)
                  }
                />
              </div>

              <ConfusionMatrix
                matrix={classification.data.confusionMatrix}
                labels={(catalogs?.iga.classes ?? []).map(
                  (c) => catalogs?.iga.labels[c] ?? c,
                )}
              />

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Clase IGA
                      </th>
                      {[
                        "Soporte",
                        "Precisión",
                        "Sensibilidad",
                        "Especificidad",
                        "F1",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {classification.data.perClass.map((row) => (
                      <tr key={row.igaClass}>
                        <td className="px-3 py-2 text-neutral-900">
                          {catalogs?.iga.labels[row.igaClass] ?? row.igaClass}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.support}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {num(row.precision, 3)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {num(row.recall, 3)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {num(row.specificity, 3)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {num(row.f1, 3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-neutral-500">
                Patrón de evaluación:{" "}
                <strong>{classification.data.standard}</strong>. Referencia de
                calibración: Watanabe (2025) reporta 90,0 % de exactitud y F1
                macro 0,885.
              </p>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 px-3 py-2">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-neutral-900">
        {value}
      </p>
    </div>
  );
}
