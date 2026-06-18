import { editorialTheme } from './editorial';
import { magazineTheme } from './magazine';
import { resolveThemeId } from './resolve';
import type { Theme, ThemeMeta } from './types';

/** The theme used whenever the stored value is unknown/empty. */
export const DEFAULT_THEME = editorialTheme;
export const DEFAULT_THEME_ID = DEFAULT_THEME.meta.id;

const all: Theme[] = [editorialTheme, magazineTheme];

/** Theme catalogue keyed by id. The web app owns this list, not the API. */
export const themes: Record<string, Theme> = Object.fromEntries(
  all.map((theme) => [theme.meta.id, theme]),
);

/** Theme metadata for the admin Appearance screen. */
export const themeCatalog: ThemeMeta[] = all.map((theme) => theme.meta);

/** Resolve a stored theme id to a concrete theme, falling back to the default. */
export function resolveTheme(id: string | null | undefined): Theme {
  return themes[resolveThemeId(id, Object.keys(themes), DEFAULT_THEME_ID)] ?? DEFAULT_THEME;
}
