# §7 #8 — Dashboard translation editing UI — Design

**Date:** 2026-06-26 · **Status:** approved · **Feature register:** `REFACTOR_PLAN.md` §7 #8

## Goal

Give admins a per-locale editor (tab strip) for Post and Page translations, driving the
existing §7 #1 endpoints. The base (en) form is unchanged; a new "Translations" panel lets
an editor fill de/ru overrides with per-field fallback to the base value.

## Context (already in place from §7 #1)

- API: `PUT /{posts,pages}/:id/translations/:locale` (body `{post,page}TranslationInputSchema`),
  `DELETE /{posts,pages}/:id/translations/:locale` (204, idempotent). Both CASL `update`.
- Admin `GET /{posts,pages}/:id` returns `PostDetail`/`PageDetail` with
  `translations: {Post,Page}Translation[]` (nullable per-field rows).
- `localizeContent` resolves base + override with **per-field fallback**; an empty field is no
  override; an all-empty save clears the row.
- Locales come from `@cmstack-ts/config` (`LOCALES`, `DEFAULT_LOCALE`). Admin UI is **English**.

This feature is **web-only**: no API, schema, or migration changes.

## Decisions

- **Per-locale save** (not a unified base+translations save): the base form keeps its current
  Save-draft/Publish buttons; the Translations panel saves each locale independently via the
  idempotent PUT/DELETE endpoints. No partial-failure/rollback complexity.
- **Scope:** Post + Page only. Category/Tag name translation has no API yet (fast-follow logged
  in §7 #1) and is out of scope.
- **No new UI dependency:** the kit has no Tabs primitive; a lightweight button tab-strip is
  built inline (state-driven).
- **Edit mode only:** translations need an existing id, so the panel renders only when editing
  (never on "new").

## Components

### `apps/web/components/admin/translations-panel.tsx` (client, reused by post + page)

Props:

```ts
interface TranslationField { key: 'title' | 'excerpt' | 'content' | 'metaTitle' | 'metaDescription'; label: string; type: 'input' | 'textarea' | 'richtext'; }
interface TranslationRow { locale: string; title: string | null; excerpt?: string | null; content: string | null; metaTitle: string | null; metaDescription: string | null; }
interface TranslationsPanelProps {
  entityId: string;
  base: Record<string, string>;            // saved en values, for fallback placeholders
  translations: TranslationRow[];           // existing override rows
  fields: TranslationField[];               // page omits 'excerpt'
  upsertAction: (id: string, locale: string, input: Record<string, string | undefined>) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteAction: (id: string, locale: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}
```

Behavior:
- Tab strip of override locales (`LOCALES.filter((l) => l !== DEFAULT_LOCALE)`), labelled in
  English (`localeLabel(locale)` → e.g. "Deutsch (de)", "Русский (ru)").
- The active locale renders its fields, pre-filled from its `TranslationRow` (null → `''`).
  Each field's **placeholder is the base value** (`base[key]`) so the editor sees what shows
  when left blank. `content` uses the existing `RichTextEditor`.
- **Save** builds the input via the pure `buildTranslationInput` (trim, drop empty → override
  only the set fields) and calls `upsertAction`; **Clear translation** calls `deleteAction`.
  Per-locale `useTransition` + `sonner` toasts. On a successful clear, the locale's fields reset
  to empty.

### `apps/web/lib/admin/translation-input.ts` (pure, unit-tested)

```ts
export function buildTranslationInput(
  fields: readonly string[],
  values: Record<string, string>,
): Record<string, string> {
  // For each allowed field, trim; keep only non-empty → an override. Empty = fall back.
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = (values[f] ?? '').trim();
    if (v) out[f] = v;
  }
  return out;
}

export function localeLabel(locale: string): string {
  const NAMES: Record<string, string> = { en: 'English', de: 'Deutsch', ru: 'Русский' };
  return `${NAMES[locale] ?? locale} (${locale})`;
}
```

## Server Actions

In `apps/web/app/admin/posts/actions.ts` (and the page equivalents in
`apps/web/app/admin/pages/actions.ts`):

```ts
export async function upsertPostTranslationAction(id, locale, input): Promise<ActionResult> {
  const parsed = postTranslationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the translation fields.' };
  try {
    await apiSend('PUT', `/posts/${id}/translations/${locale}`, parsed.data);
    revalidatePath('/admin/posts');
    revalidatePath('/', 'layout'); // public localized surfaces
    return { ok: true };
  } catch (err) { return fail(err, 'Failed to save translation'); }
}
export async function deletePostTranslationAction(id, locale): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/posts/${id}/translations/${locale}`);
    revalidatePath('/admin/posts');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) { return fail(err, 'Failed to clear translation'); }
}
```

Pages use `pageTranslationInputSchema` and `/pages/...`. The `locale` is validated server-side
by the API (`localeSchema`); the action passes it through.

## Wiring

- `apps/web/app/admin/posts/[id]/edit/page.tsx`: render `<TranslationsPanel>` after `<PostForm>`,
  passing `entityId={post.id}`, `base` from the saved post (title/excerpt/content/metaTitle/
  metaDescription), `translations={post.translations}`, the post field set (incl. excerpt), and the
  post upsert/delete actions.
- `apps/web/app/admin/pages/[id]/edit/page.tsx`: same, with the page field set (no excerpt) and the
  page actions.

## Testing

- **Unit:** `buildTranslationInput` (trims, drops empty, keeps set fields, respects the allowed
  field list); `localeLabel`.
- **Live / e2e:** edit a post → add a `de` override (title + content) → Save → `/de/blog/<slug>`
  shows the override, en stays the base, a blank field falls back; Clear → the override is gone.
  Existing `pnpm e2e` (11/11) must stay green; coverage gate ≥80% holds.

## Out of scope (logged, not silent)

Category/Tag name translation (no API yet — fast-follow from §7 #1); translating slug/status/
taxonomy (shared by design in the §7 #1 model); machine translation; a translation-completeness
indicator beyond "row exists / doesn't".
