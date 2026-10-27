'use client';

import { useApi } from '@/lib/use-api';

/**
 * Domain catalogues served by `GET /meta/catalogs`.
 *
 * This is how the frontend gets the VALUES that OpenAPI generation cannot provide: the Spanish
 * labels, the verbatim Likert wording, the indicator formulas and targets, the disclaimer. The
 * portal renders these strings and never rewrites them — the questionnaire in particular was
 * validated as written, so a paraphrase in the UI would invalidate the instrument.
 */
export interface Catalogs {
  thesis: {
    title: string;
    university: string;
    faculty: string;
    school: string;
    authors: string[];
    advisor: string;
    researchLine: string;
    year: number;
  };
  disclaimer: string;
  references: string[];
  iga: {
    classes: string[];
    labels: Record<string, string>;
    ordinal: Record<string, number>;
  };
  gags: { grades: string[]; labels: Record<string, string> };
  fitzpatrick: string[];
  sexes: string[];
  studyModes: { values: string[]; labels: Record<string, string> };
  caseStatuses: { values: string[]; labels: Record<string, string> };
  /** What the staff sees: Borrador, En revisión, Revisado — each grouping internal statuses. */
  caseStages: {
    values: string[];
    labels: Record<string, string>;
    ofStatus: Record<string, string>;
  };
  workShifts: { values: string[]; labels: Record<string, string> };
  roles: {
    values: string[];
    labels: Record<string, string>;
    /**
     * Role groupings served by the API so the portal never re-lists them.
     * `groups.diagnosing` is what «Personal médico» means; `groups.identity` is who may see a
     * patient's name (RF-TR-03).
     */
    groups: Record<string, string[]>;
  };
  indicators: {
    keys: string[];
    definitions: Record<
      string,
      {
        key: string;
        objective: string;
        hypothesis: string;
        name: string;
        formula: string;
        unit: string;
        instrument: string;
        direction: 'lower' | 'higher';
        target: string;
      }
    >;
    targets: Record<string, number>;
  };
  hypotheses: {
    keys: string[];
    statements: Record<string, string>;
    nullStatements: Record<string, string>;
    indicator: Record<string, string>;
    alternative: Record<string, string>;
    general: { h1: string; h0: string };
    testLabels: Record<string, string>;
  };
  survey: {
    items: { number: number; text: string }[];
    scale: Record<string, string>;
    totalPoints: number;
  };
  anamnesis: {
    version: string;
    sections: string[];
    sectionLabels: Record<string, string>;
    questions: AnamnesisQuestion[];
  };
  shots: {
    keys: string[];
    definitions: { key: string; label: string; instruction: string; required: boolean }[];
  };
  /**
   * Proceso clínico. No alimenta ningún indicador: la validación y la receta los necesitan para
   * pintarse sin duplicar las listas del dominio.
   *
   * `icd10` es el único que el servidor lee de la BASE y no de una constante: es el catálogo que un
   * mantenedor puede ampliar sin desplegar.
   */
  icd10: { code: string; name: string }[];
  prescriptionStatuses: { values: string[]; labels: Record<string, string> };
  deliveryChannels: {
    values: string[];
    labels: Record<string, string>;
    /** Canales que el prototipo registra sin ejecutar: no hay pasarela contratada. */
    simulated: string[];
  };
}

/** One question of the acne intake questionnaire, as served by `GET /meta/catalogs`. */
export interface AnamnesisQuestion {
  key: string;
  number: number;
  section: string;
  text: string;
  type: 'booleano' | 'texto' | 'numero' | 'opcion_unica' | 'opcion_multiple';
  options?: string[];
  unit?: string;
  scope: 'siempre' | 'mujer_adulta';
  required: boolean;
  detail?: string;
  hint?: string;
}

/** One answer: the value typed by its question plus the optional free-text follow-up. */
export interface AnamnesisAnswer {
  value: boolean | string | number | string[] | null;
  detail?: string | null;
}

/** Age from which the hormonal block applies, mirroring `ANAMNESIS_ADULT_AGE` in the API. */
const ADULT_AGE = 18;

/**
 * The questions that apply to one patient.
 *
 * Mirrors `anamnesisQuestionsFor` in `acne-api/src/common/domain/anamnesis.ts`, which is the
 * authority: the server validates against its own copy and rejects an answer to a question that
 * does not apply. Duplicating the RULE here (not the wording, which is served) is what keeps the
 * form from offering a question the API would refuse.
 */
export function anamnesisQuestionsFor(
  catalogs: Catalogs | null,
  sex: string | null | undefined,
  ageYears: number | null | undefined,
): AnamnesisQuestion[] {
  const questions = catalogs?.anamnesis.questions ?? [];
  const hormonal =
    sex === 'femenino' && ageYears !== null && ageYears !== undefined && ageYears >= ADULT_AGE;
  return questions.filter((question) => question.scope === 'siempre' || hormonal);
}

export function useCatalogs() {
  return useApi<Catalogs>('/meta/catalogs');
}

/** IGA label lookup with a readable fallback while the catalogues are loading. */
export function igaLabel(catalogs: Catalogs | null, igaClass: string | null | undefined): string {
  if (igaClass === null || igaClass === undefined) return '—';
  return catalogs?.iga.labels[igaClass] ?? igaClass.replace(/_/g, ' ');
}
