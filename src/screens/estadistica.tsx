"use client";

import { Download, FlaskConical } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { api, type PostResult } from "@/lib/api";
import { num, pValue } from "@/lib/format";
import { useAction } from "@/lib/use-api";
import { useCatalogs } from "@/lib/use-catalogs";

type GeneralResult = PostResult<"/stats/hypothesis/all">;

/**
 * One-click statistical panel (Sección 9.3).
 *
 * Covers: RF-OE1-04, RF-OE2-05, RF-OE3-05, RF-OE4-03. Every run is persisted immutably by the
 * API in `hypothesis_runs`, with the exact paired data, the seed and the version of the
 * statistical function, so an external evaluator can reproduce any figure (RNF-05).
 */
export default function EstadisticaPage() {
  const [includeSynthetic, setIncludeSynthetic] = useState(true);
  const [result, setResult] = useState<GeneralResult | null>(null);
  const { data: catalogs } = useCatalogs();

  const { run, pending, error } = useAction(async () =>
    api.post<GeneralResult>("/stats/hypothesis/all", { includeSynthetic }),
  );

  async function execute(): Promise<void> {
    const outcome = await run();
    if (outcome !== null) setResult(outcome);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Análisis estadístico"
        description="Shapiro-Wilk sobre las diferencias pareadas → t de Student para muestras relacionadas o Wilcoxon de rangos con signo, según normalidad. α = 0,05."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void execute()} loading={pending}>
              <FlaskConical className="h-4 w-4" aria-hidden />
              Contrastar HE₁–HE₄
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void api.download(
                  `/reports/contraste-hipotesis/pdf?includeSynthetic=${includeSynthetic}`,
                  "REPORTE-CONTRASTE-HIPOTESIS.pdf",
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

      {error !== null ? (
        <Alert tone="danger" title="No se pudo ejecutar el contraste">
          {error.message}
        </Alert>
      ) : null}

      {result === null ? (
        <Card>
          <CardBody>
            <p className="py-8 text-center text-sm text-neutral-500">
              Pulse <strong>Contrastar HE₁–HE₄</strong> para ejecutar las cuatro
              pruebas y derivar la conclusión sobre la hipótesis general H₁.
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card
            className={
              result.rejectsNull
                ? "border-emerald-600/50"
                : "border-amber-500/50"
            }
          >
            <CardHeader
              title="Hipótesis general (OG)"
              action={
                <Badge variant={result.rejectsNull ? "success" : "warning"}>
                  {result.rejectsNull ? "Se rechaza H₀" : "No se rechaza H₀"}
                </Badge>
              }
            />
            <CardBody className="space-y-3 text-sm">
              <p>
                <strong className="text-neutral-900">H₁:</strong>{" "}
                <span className="text-neutral-500">{result.h1}</span>
              </p>
              <p>
                <strong className="text-neutral-900">H₀:</strong>{" "}
                <span className="text-neutral-500">{result.h0}</span>
              </p>
              <p className="rounded-md border-l-4 border-purple-900 bg-purple-50 px-4 py-3 text-neutral-900">
                {result.conclusion}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Resumen de los contrastes"
              description={`${result.rejectedCount} de ${result.totalCount} hipótesis específicas rechazan H₀.`}
            />
            <CardBody>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Hipótesis</Th>
                    <Th>Indicador</Th>
                    <Th numeric>n</Th>
                    <Th>Shapiro-Wilk</Th>
                    <Th>Prueba aplicada</Th>
                    <Th numeric>Estadístico</Th>
                    <Th numeric>p-valor</Th>
                    <Th>Decisión</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {result.results.map((test) => (
                    <Tr key={test.hypothesis}>
                      <Td className="font-medium">{test.hypothesis}</Td>
                      <Td>{test.indicator}</Td>
                      <Td numeric>{test.nPairs}</Td>
                      <Td>
                        {test.normality.applicable ? (
                          <span className="text-xs">
                            W = {num(test.normality.statistic, 4)}; p ={" "}
                            {num(test.normality.pValue, 4)}
                            <br />
                            <span
                              className={
                                test.normality.normal
                                  ? "text-emerald-700"
                                  : "text-amber-600"
                              }
                            >
                              {test.normality.normal ? "Normal" : "No normal"}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-500">
                            No aplicable
                          </span>
                        )}
                      </Td>
                      <Td className="text-xs">{test.testLabel}</Td>
                      <Td numeric>{num(test.statistic, 4)}</Td>
                      <Td numeric>{pValue(test.pValue)}</Td>
                      <Td>
                        <Badge
                          variant={test.rejectsNull ? "success" : "neutral"}
                        >
                          {test.rejectsNull ? "Rechaza H₀" : "No rechaza"}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>

          {result.results.map((test) => (
            <Card key={test.id}>
              <CardHeader
                title={`${test.hypothesis} — ${test.indicator}`}
                description={test.statement}
                action={
                  <Badge variant={test.rejectsNull ? "success" : "neutral"}>
                    {test.rejectsNull ? "Se rechaza H₀" : "No se rechaza H₀"}
                  </Badge>
                }
              />
              <CardBody className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <Metric label="Media pretest" value={num(test.pretestMean)} />
                  <Metric label="Media postest" value={num(test.postestMean)} />
                  <Metric label="Diferencia" value={num(test.meanDifference)} />
                  <Metric
                    label={`p-valor (α = ${num(test.alpha, 3)})`}
                    value={pValue(test.pValue)}
                  />
                </div>

                {test.effectSize !== null ? (
                  <p className="text-sm text-neutral-500">
                    <strong className="text-neutral-900">
                      Tamaño del efecto:
                    </strong>{" "}
                    {test.effectSize.kind} = {num(test.effectSize.value, 4)} (
                    {test.effectSize.magnitude})
                  </p>
                ) : null}

                {test.normality.note != null ? (
                  <Alert tone="info">{test.normality.note}</Alert>
                ) : null}

                <p className="rounded-md border-l-4 border-purple-900 bg-purple-50 px-4 py-3 text-sm text-neutral-900">
                  {test.conclusion}
                </p>

                <details className="rounded-md border border-neutral-200">
                  <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-neutral-900">
                    Datos pareados ({test.pairs.length}) y trazabilidad
                  </summary>
                  <div className="border-t border-neutral-200 px-4 py-3">
                    <p className="mb-3 text-xs text-neutral-500">
                      Ejecución <code>{test.id}</code> · semilla {test.seed} ·
                      función {test.functionVersion} · hash de insumos{" "}
                      <code>{test.inputHash.slice(0, 16)}…</code> (RNF-05)
                    </p>
                    <Table>
                      <Thead>
                        <Tr>
                          <Th>Unidad</Th>
                          <Th numeric>Pretest</Th>
                          <Th numeric>Postest</Th>
                          <Th numeric>Diferencia</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {test.pairs.map((pair, index) => (
                          <Tr key={`${pair.label}-${index}`}>
                            <Td>{pair.label}</Td>
                            <Td numeric>{num(pair.pretest)}</Td>
                            <Td numeric>{num(pair.postest)}</Td>
                            <Td numeric>{num(pair.difference)}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </div>
                </details>
              </CardBody>
            </Card>
          ))}

          {catalogs !== null ? (
            <p className="text-xs text-neutral-500">
              Referencia metodológica:{" "}
              {catalogs.references.find((r) => r.startsWith("Hernández"))}
            </p>
          ) : null}
        </>
      )}
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
