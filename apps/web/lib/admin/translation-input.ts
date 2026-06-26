/**
 * Build a translation override payload from raw form values: trim each allowed
 * field and keep only the non-empty ones. An empty field is no override (the
 * public site falls back to the base value); an all-empty result clears the row.
 */
export function buildTranslationInput(
  fields: readonly string[],
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = (values[f] ?? '').trim();
    if (v) out[f] = v;
  }
  return out;
}

const LOCALE_NAMES: Record<string, string> = { en: 'English', de: 'Deutsch', ru: 'Русский' };

/** English-facing label for a locale tab, e.g. "Deutsch (de)". */
export function localeLabel(locale: string): string {
  return `${LOCALE_NAMES[locale] ?? locale} (${locale})`;
}
