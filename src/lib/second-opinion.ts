import { shotLabel, type ShotDefinitionLike } from "@/lib/shots";

/**
 * What to tell the clinician when the second opinion taken before grading disagrees with «acne».
 *
 * The engine's local filter sometimes lets through photographs that are not acne — a phone
 * close-up of vitiligo scored 99,5 % acne — and the IGA models then grade them. For each image it
 * lets through, an independent model is asked whether it shows acne, healthy skin or another
 * condition. When it sees another condition the view is not graded (`verdictSource =
 * segunda_opinion`) and this warning says why; otherwise the reading is shown as usual and the
 * warning sits next to it so it is read knowing the photograph may not show acne. Either way the
 * analysis is never blocked and the specialist decides.
 */

export type SecondOpinionLabel =
  "acne" | "piel_sana" | "otra_condicion" | "indeterminado";

export interface SecondOpinionLike {
  label: SecondOpinionLabel;
  conditions: readonly string[];
  explanation: string;
}

export interface SecondOpinionViewLike {
  imageId: string;
  shotKey: string | null;
  inference: {
    secondOpinion?: SecondOpinionLike | null;
    /** `no_acne` with `segunda_opinion` as source: the view was NOT graded because of it. */
    verdict?: "acne" | "piel_sana" | "no_acne";
    verdictSource?: "filtro" | "segunda_opinion";
  };
}

export interface SecondOpinionFinding {
  imageId: string;
  shot: string;
  /** «Vitíligo», «melasma, rosácea», «Piel sana» or «Acné con vitíligo». */
  headline: string;
  explanation: string;
  /** `otra`: no acne, another condition. `sana`: no acne at all. `coexiste`: acne plus another. */
  kind: "otra" | "sana" | "coexiste";
  /** False when the view was not graded because of this opinion (no IGA class for it). */
  graded: boolean;
}

export interface SecondOpinionNotice {
  title: string;
  message: string;
  findings: SecondOpinionFinding[];
  /** Stable while the same views say the same thing, so a toast is not repeated on every poll. */
  key: string;
}

function capitalise(text: string): string {
  return text === "" ? text : text[0]!.toUpperCase() + text.slice(1);
}

/** The warning one view deserves, or null when its second opinion agrees with acne (or is absent). */
export function findingFor(
  view: SecondOpinionViewLike,
  shots: readonly ShotDefinitionLike[],
): SecondOpinionFinding | null {
  const opinion = view.inference.secondOpinion;
  if (opinion === null || opinion === undefined) return null;
  const named = opinion.conditions.join(", ");
  const shot = shotLabel(shots, view.shotKey);
  const graded = !(
    view.inference.verdict === "no_acne" &&
    view.inference.verdictSource === "segunda_opinion"
  );
  const base = {
    imageId: view.imageId,
    shot,
    explanation: opinion.explanation,
    graded,
  };

  if (opinion.label === "otra_condicion") {
    return {
      ...base,
      kind: "otra",
      headline: named === "" ? "Otra condición" : capitalise(named),
    };
  }
  if (opinion.label === "piel_sana") {
    return { ...base, kind: "sana", headline: "Piel sana" };
  }
  // Acne, but next to something else: still worth saying, the grade covers only the acne.
  if (opinion.label === "acne" && named !== "") {
    return { ...base, kind: "coexiste", headline: `Acné con ${named}` };
  }
  return null;
}

export function describeSecondOpinion(
  views: readonly SecondOpinionViewLike[] | null | undefined,
  shots: readonly ShotDefinitionLike[],
): SecondOpinionNotice | null {
  const findings = (views ?? [])
    .map((view) => findingFor(view, shots))
    .filter((finding): finding is SecondOpinionFinding => finding !== null);
  if (findings.length === 0) return null;

  const notAcne = findings.filter((f) => f.kind !== "coexiste");
  const stopped = findings.filter((f) => !f.graded);
  // A clear cheek stopped beside an affected one (SECOND_OPINION_REQUIRE_ACNE): acne on one side
  // only is normal, and the grade comes from the views that show it.
  const stoppedHealthy = stopped.filter((f) => f.kind === "sana");
  const stoppedOther = stopped.filter((f) => f.kind !== "sana");
  const gradedAcne = (views ?? []).some(
    (view) => view.inference?.verdict === "acne",
  );
  const warnedOnly = notAcne.filter((f) => f.graded);
  const others = [
    ...new Set(
      findings
        .filter((f) => f.kind !== "sana")
        .map((f) => f.headline.replace(/^Acné con /, "")),
    ),
  ];

  const title =
    notAcne.length === 0
      ? `Verificación previa: además del acné se observa ${others.join(", ").toLowerCase()}`
      : others.length > 0
        ? `Verificación previa: posible ${others.join(", ").toLowerCase()}, no acné`
        : gradedAcne
          ? "Verificación previa: hay zonas del rostro sin acné"
          : "Verificación previa: la piel parece sana, no acné";

  const count = (n: number): string => (n === 1 ? "Una toma" : `${n} tomas`);
  const parts: string[] = [];
  if (stoppedHealthy.length > 0 && gradedAcne) {
    parts.push(
      `${count(stoppedHealthy.length)} sin acné ${stoppedHealthy.length === 1 ? "quedó" : "quedaron"} ` +
        "fuera de la sugerencia: la clase IGA se calcula con las tomas que sí muestran acné.",
    );
  }
  const stoppedRest = gradedAcne ? stoppedOther : stopped;
  if (stoppedRest.length > 0) {
    parts.push(
      `${count(stoppedRest.length)} no se ${stoppedRest.length === 1 ? "graduó" : "graduaron"}: la ` +
        "escala IGA mide acné y no aplica a otra condición." +
        (stopped.length === findings.length && findings.length === views?.length
          ? " El caso queda sin clase sugerida; el diagnóstico es del especialista."
          : ""),
    );
  }
  if (warnedOnly.length > 0) {
    parts.push(
      `${count(warnedOnly.length)} podría${warnedOnly.length === 1 ? "" : "n"} no mostrar acné ` +
        "y se graduó igualmente: interprete la clase sugerida con cautela.",
    );
  }
  if (parts.length === 0) {
    parts.push(
      "La lectura IGA se refiere solo al acné; valore la otra condición por separado.",
    );
  }
  const message = parts.join(" ");

  const key = findings
    .map((f) => `${f.imageId}:${f.kind}:${f.headline}:${f.graded}`)
    .sort()
    .join("|");

  return { title, message, findings, key };
}
