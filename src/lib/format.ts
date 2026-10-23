/**
 * Number formatting for the clinical UI.
 *
 * The thesis text and the generated PDF reports use the DECIMAL COMMA, so every figure the portal
 * shows must match what ends up printed: a dashboard reading "8.78" beside a report reading
 * "8,78" invites transcription errors in the results chapter.
 *
 * Note the locale is NOT `es-PE`. Peru's CLDR locale uses the decimal POINT (like Mexico), so
 * formatting by country would contradict the document. The locale is therefore pinned to the
 * convention of the thesis, not of the country.
 */
const NUMBER_LOCALE = 'es-ES';

export function num(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString(NUMBER_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function pct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${num(value, decimals)} %`;
}

/** Signed percentage, for the pretest → postest variation. */
export function delta(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${num(value, decimals)} %`;
}

/** p-values below 0,001 are reported as such, the convention in the results chapter. */
export function pValue(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value < 0.001 ? '< 0,001' : num(value, 4);
}

export function date(iso: string | null | undefined): string {
  if (!iso) return '—';
  // Una fecha sin hora (`2026-10-19`) ya es la fecha civil: `new Date()` la leería como medianoche UTC
  // y en Lima (UTC-5) se mostraría un día antes.
  const civil = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (civil) return `${civil[3]}/${civil[2]}/${civil[1]}`;
  const parsed = new Date(iso);
  // Dates DO follow the Peruvian convention (dd/mm/aaaa); only the decimal separator differs.
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? '—'
    : parsed.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
