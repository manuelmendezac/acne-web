import { describe, expect, it } from "vitest";

import {
  lacksAcneEvidence,
  listShotLabels,
  missingRequiredShots,
  pickImageForInference,
  shotLabel,
} from "./shots";

const shots = [
  { key: "general", label: "Vista general", required: true },
  { key: "acercamiento", label: "Acercamiento", required: false },
  { key: "perfil_derecho", label: "Perfil derecho", required: true },
  { key: "perfil_izquierdo", label: "Perfil izquierdo", required: true },
];

const image = (id: string, shotKey: string | null, isHeatmap = false) => ({
  id,
  shotKey,
  isHeatmap,
});

describe("missingRequiredShots", () => {
  it("lists every required shot for a case without photographs", () => {
    expect(missingRequiredShots([], shots).map((s) => s.key)).toEqual([
      "general",
      "perfil_derecho",
      "perfil_izquierdo",
    ]);
  });

  it("credits only labelled clinical photographs", () => {
    const images = [
      image("a", "general"),
      image("b", null),
      image("c", "perfil_izquierdo", true),
      image("d", "acercamiento"),
    ];
    expect(missingRequiredShots(images, shots).map((s) => s.key)).toEqual([
      "perfil_derecho",
      "perfil_izquierdo",
    ]);
  });

  it("is empty once the three views are there", () => {
    const images = [
      image("a", "general"),
      image("b", "perfil_derecho"),
      image("c", "perfil_izquierdo"),
    ];
    expect(missingRequiredShots(images, shots)).toEqual([]);
  });
});

describe("labels", () => {
  it("joins the human labels for a banner", () => {
    expect(listShotLabels(shots.slice(0, 2))).toBe(
      "Vista general, Acercamiento",
    );
  });

  it("names an unlabelled photograph without inventing a view", () => {
    expect(shotLabel(shots, null)).toBe("Sin toma asignada");
    expect(shotLabel(shots, "perfil_derecho")).toBe("Perfil derecho");
    expect(shotLabel(shots, "otra")).toBe("otra");
  });
});

describe("pickImageForInference", () => {
  it("prefers the latest frontal view over anything else", () => {
    const images = [
      image("old", "general"),
      image("side", "perfil_derecho"),
      image("new", "general"),
    ];
    expect(pickImageForInference(images)?.id).toBe("new");
  });

  it("falls back to the most recent clinical photograph", () => {
    const images = [
      image("a", "perfil_derecho"),
      image("b", null),
      image("h", "general", true),
    ];
    expect(pickImageForInference(images)?.id).toBe("b");
  });

  it("returns undefined with nothing to analyse", () => {
    expect(
      pickImageForInference([image("h", "general", true)]),
    ).toBeUndefined();
  });
});

describe("lacksAcneEvidence", () => {
  const read = (shotKey: string, acneCheck: string | null) => ({
    shotKey,
    isHeatmap: false,
    acneCheck,
  });

  it("blocks when every required shot was checked and none shows acne", () => {
    const images = [
      read("general", "piel_sana"),
      read("perfil_derecho", "piel_sana"),
      read("perfil_izquierdo", "indeterminado"),
    ];
    expect(lacksAcneEvidence(images, shots)).toBe(true);
  });

  it("lets one photograph with acne be enough", () => {
    const images = [
      read("general", "piel_sana"),
      read("perfil_derecho", "acne"),
      read("perfil_izquierdo", "piel_sana"),
    ];
    expect(lacksAcneEvidence(images, shots)).toBe(false);
  });

  it("blocks nothing when a shot has no reading", () => {
    expect(
      lacksAcneEvidence(
        [read("general", "piel_sana"), read("perfil_derecho", null)],
        shots,
      ),
    ).toBe(false);
    expect(lacksAcneEvidence([], shots)).toBe(false);
  });
});
