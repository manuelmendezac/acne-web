"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { Badge, StudyModeBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/portal/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { EmptyState, ErrorState, Loading } from "@/components/ui/feedback";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { api, type GetResult } from "@/lib/api";
import { cn } from "@/lib/cn";
import { date, num } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { igaLabel, useCatalogs } from "@/lib/use-catalogs";

type Anexo4Row = GetResult<"/study/anexo-4">[number];
type Anexo5Row = GetResult<"/diagnoses/anexo-5">[number];
type Anexo7Row = GetResult<"/sessions/anexo-7">[number];

const TABS = [
  { key: "anexo-4", label: "Anexo 4 · Tiempo de revisión", objective: "OE1" },
  {
    key: "anexo-5",
    label: "Anexo 5 · Precisión diagnóstica",
    objective: "OE2",
  },
  {
    key: "anexo-7",
    label: "Anexo 7 · Capacidad de atención",
    objective: "OE4",
  },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Digitised instruments.
 *
 * Each table reproduces the columns of the paper instrument exactly (RF-OE1-02, RF-OE2-02,
 * RF-OE4-01), so what the researcher transcribes into the thesis annexes is what the system
 * shows, field for field.
 */
/** Un CSV de postest por objetivo: OE1 tiempos, OE2 diagnósticos, OE3 encuestas, OE4 jornadas. */
const POSTEST_EXPORTS = [
  { dataset: "tiempos", file: "OE1-tiempos-revision-postest.csv" },
  { dataset: "diagnosticos", file: "OE2-precision-diagnostica-postest.csv" },
  { dataset: "encuestas", file: "OE3-satisfaccion-postest.csv" },
  { dataset: "jornadas", file: "OE4-capacidad-atencion-postest.csv" },
] as const;

async function exportPostest(includeSynthetic: boolean): Promise<void> {
  for (const { dataset, file } of POSTEST_EXPORTS) {
    await api.download(
      `/stats/dataset-export?dataset=${dataset}&mode=postest&includeSynthetic=${includeSynthetic}`,
      file,
    );
    // Los navegadores descartan descargas encadenadas sin pausa.
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

export default function AnexosPage() {
  const [tab, setTab] = useState<TabKey>("anexo-4");
  const [studyMode, setStudyMode] = useState("");
  const [includeSynthetic, setIncludeSynthetic] = useState(true);
  const { data: catalogs } = useCatalogs();

  const query = {
    studyMode: studyMode === "" ? undefined : studyMode,
    includeSynthetic,
  };

  const path =
    tab === "anexo-4"
      ? "/study/anexo-4"
      : tab === "anexo-5"
        ? "/diagnoses/anexo-5"
        : "/sessions/anexo-7";
  const rows = useApi<Anexo4Row[] | Anexo5Row[] | Anexo7Row[]>(path, query, [
    tab,
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Instrumentos digitalizados"
        description="Las fichas de registro de los Anexos 4, 5 y 7, con los mismos campos del instrumento en papel."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void exportPostest(includeSynthetic)}
            >
              <Download className="h-4 w-4" aria-hidden />
              Exportar postest (OE1–OE4)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void api.download(
                  `/stats/dataset-export?dataset=mediciones&includeSynthetic=${includeSynthetic}`,
                  "dataset-mediciones.csv",
                )
              }
            >
              <Download className="h-4 w-4" aria-hidden />
              Exportar CSV
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-md border px-3 py-2 text-sm transition-colors",
              tab === item.key
                ? "border-purple-900 bg-purple-50 font-medium text-purple-900"
                : "border-neutral-200 text-neutral-500 hover:bg-neutral-100",
            )}
          >
            {item.label}
            <Badge variant="outline" className="ml-2">
              {item.objective}
            </Badge>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader
          title={TABS.find((item) => item.key === tab)?.label ?? ""}
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={studyMode}
                onChange={(event) => setStudyMode(event.target.value)}
                className="w-44"
              >
                <option value="">Todas las condiciones</option>
                <option value="pretest">Pretest</option>
                <option value="postest">Postest</option>
              </Select>
              <label className="flex items-center gap-2 text-xs text-neutral-500">
                <input
                  type="checkbox"
                  checked={includeSynthetic}
                  onChange={(event) =>
                    setIncludeSynthetic(event.target.checked)
                  }
                  className="h-4 w-4 rounded border-neutral-300 text-purple-900 focus:ring-purple-900"
                />
                Sintéticos
              </label>
            </div>
          }
        />
        <CardBody className="p-0">
          {rows.loading ? (
            <Loading />
          ) : rows.error !== null ? (
            <div className="p-5">
              <ErrorState message={rows.error.message} onRetry={rows.reload} />
            </div>
          ) : (rows.data ?? []).length === 0 ? (
            <EmptyState title="Sin registros para este filtro" />
          ) : tab === "anexo-4" ? (
            <Table caption="N.º · fecha · N.º de caso / ID de paciente · hora de inicio de revisión · tiempo de revisión (min).">
              <Thead>
                <Tr>
                  <Th numeric>N.º</Th>
                  <Th>Fecha</Th>
                  <Th>Caso</Th>
                  <Th>Paciente</Th>
                  <Th>Profesional</Th>
                  <Th>Condición</Th>
                  <Th>Hora de inicio</Th>
                  <Th numeric>Tiempo (min)</Th>
                  <Th>Válida</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(rows.data as Anexo4Row[]).map((row) => (
                  <Tr key={`${row.caseCode}-${row.studyMode}`}>
                    <Td numeric>{row.number}</Td>
                    <Td>{date(row.date)}</Td>
                    <Td className="font-mono text-xs">{row.caseCode}</Td>
                    <Td className="font-mono text-xs text-neutral-500">
                      {row.patientCode}
                    </Td>
                    <Td className="text-sm">{row.professional}</Td>
                    <Td>
                      <StudyModeBadge mode={row.studyMode} />
                    </Td>
                    <Td className="text-sm text-neutral-500">
                      {new Date(row.startTime).toLocaleTimeString("es-PE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Td>
                    <Td numeric className="font-medium">
                      {num(row.reviewMinutes)}
                    </Td>
                    <Td>
                      {row.valid ? (
                        <Badge variant="success">Sí</Badge>
                      ) : (
                        <Badge variant="danger">No</Badge>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : tab === "anexo-5" ? (
            <Table caption="N.º · fecha · diagnóstico IA · diagnóstico de referencia · resultado. La columna «patrón» declara contra qué se evaluó cada fila.">
              <Thead>
                <Tr>
                  <Th numeric>N.º</Th>
                  <Th>Fecha</Th>
                  <Th>Caso</Th>
                  <Th>Condición</Th>
                  <Th>Diagnóstico IA</Th>
                  <Th numeric>Confianza</Th>
                  <Th>Diagnóstico de referencia</Th>
                  <Th>Resultado</Th>
                  <Th>Patrón</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(rows.data as Anexo5Row[]).map((row) => (
                  <Tr key={`${row.caseCode}-${row.studyMode}-${row.number}`}>
                    <Td numeric>{row.number}</Td>
                    <Td>{date(row.date)}</Td>
                    <Td className="font-mono text-xs">{row.caseCode}</Td>
                    <Td>
                      <StudyModeBadge mode={row.studyMode} />
                    </Td>
                    <Td>{igaLabel(catalogs, row.aiDiagnosis)}</Td>
                    <Td numeric>
                      {row.aiConfidence === null
                        ? "—"
                        : `${num(row.aiConfidence * 100, 1)} %`}
                    </Td>
                    <Td>{igaLabel(catalogs, row.referenceDiagnosis)}</Td>
                    <Td>
                      {row.result === null ? (
                        <Badge variant="outline">—</Badge>
                      ) : row.result === "correcto" ? (
                        <Badge variant="success">Correcto</Badge>
                      ) : (
                        <Badge variant="danger">Incorrecto</Badge>
                      )}
                    </Td>
                    <Td className="text-xs text-neutral-500">{row.standard}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <Table caption="N.º · fecha · jornada/turno · número de casos revisados (NCR) · duración de la jornada (TJ).">
              <Thead>
                <Tr>
                  <Th numeric>N.º</Th>
                  <Th>Fecha</Th>
                  <Th>Profesional</Th>
                  <Th>Turno</Th>
                  <Th>Condición</Th>
                  <Th numeric>NCR</Th>
                  <Th numeric>TJ (h)</Th>
                  <Th numeric>TCAD</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(rows.data as Anexo7Row[]).map((row) => (
                  <Tr key={`${row.number}-${row.date}-${row.professional}`}>
                    <Td numeric>{row.number}</Td>
                    <Td>{date(row.date)}</Td>
                    <Td className="text-sm">{row.professional}</Td>
                    <Td className="text-sm">
                      {catalogs?.workShifts.labels[row.shift] ?? row.shift}
                    </Td>
                    <Td>
                      <StudyModeBadge mode={row.studyMode} />
                    </Td>
                    <Td numeric>{row.casesReviewed}</Td>
                    <Td numeric>{num(row.durationHours)}</Td>
                    <Td numeric className="font-medium">
                      {num(row.tcad)}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
