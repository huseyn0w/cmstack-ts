/**
 * Pure theme-id resolution, kept free of React/Next imports so it is trivially
 * unit-tested and reusable on both the server resolver and the registry. Any
 * unknown, empty, or nullish requested id falls back to the default theme.
 */
export function resolveThemeId(
  requested: string | null | undefined,
  knownIds: readonly string[],
  defaultId: string,
): string {
  if (requested && knownIds.includes(requested)) {
    return requested;
  }
  return defaultId;
}
