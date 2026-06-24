/**
 * Overlay a per-locale translation onto its base (default-locale) content with
 * per-field fallback: for each listed field, use the translation's value when it
 * is present (non-null/undefined), otherwise keep the base value. A `null`
 * translation (no row for the requested locale) returns the base verbatim.
 *
 * Pure and framework-free so the fallback policy is unit-tested in isolation.
 */
export function localizeContent<T extends Record<string, unknown>>(
  base: T,
  translation: Partial<Record<keyof T, unknown>> | null | undefined,
  fields: readonly (keyof T)[],
): T {
  if (!translation) return base;
  const result = { ...base };
  for (const field of fields) {
    const translated = translation[field];
    if (translated !== null && translated !== undefined) {
      result[field] = translated as T[keyof T];
    }
  }
  return result;
}
