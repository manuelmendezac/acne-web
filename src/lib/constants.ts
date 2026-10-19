/**
 * Fallback copies of two strings the portal may need before the API answers.
 *
 * The AUTHORITATIVE copy of both lives in `acne-api/src/common/domain/` and reaches this app
 * through `GET /meta/catalogs` (see `useCatalogs`). These constants exist only so a first paint —
 * or an offline PWA shell — never renders a clinical screen without its regulatory notice. Every
 * surface that has the catalogs loaded must prefer the served value.
 */

export const DISCLAIMER =
  'Herramienta de apoyo diagnóstico con fines de investigación académica. No sustituye el juicio ' +
  'clínico del profesional médico. Prototipo académico UNT — no certificado como dispositivo ' +
  'médico. Diagnóstico preliminar sujeto a validación por el especialista.';

/** The product name, as shown in the chrome, the browser tab and the manifest. */
export const PRODUCT_NAME = 'Dermatrix';
export const PRODUCT_TAGLINE = 'Sistema de apoyo al diagnóstico dermatológico';

/** Institutional credit, shown discreetly at the foot of the sign-in screen. */
export const THESIS_INSTITUTION = 'Universidad Nacional de Trujillo';
export const THESIS_SCHOOL = 'Escuela de Ingeniería de Sistemas · 2026';
