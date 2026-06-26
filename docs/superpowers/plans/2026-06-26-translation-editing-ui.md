# Dashboard Translation Editing UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin per-locale tab-strip editor for Post and Page translations, driving the existing §7 #1 endpoints.

**Architecture:** A reusable client `TranslationsPanel` renders override-locale tabs below the base (en) form; each locale's Save/Clear call new Server Actions that PUT/DELETE the §7 #1 translation endpoints. A pure helper builds the override input (trim, drop empty). Web-only — no API/schema/migration change.

**Tech Stack:** Next.js App Router (web, ESM), Server Actions, `@cmstack-ts/config` (locales + translation schemas), existing `RichTextEditor`, Vitest, Biome.

## Global Constraints

- Reply to the operator in **Russian**; code/comments/docs in **English**.
- Admin UI stays **English** (per CLAUDE.md); locale tab labels are English-ish (`localeLabel`).
- Shared contracts from `@cmstack-ts/config` (never redefine); locales from `LOCALES`/`DEFAULT_LOCALE`.
- Per-locale save model: base form untouched; translations saved independently via idempotent PUT/DELETE.
- Scope: Post + Page only (Category/Tag translation has no API — out of scope).
- No new UI dependency (build the tab strip inline).
- All gates before commit: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm vitest run --coverage` (≥80%), then live SSR + `pnpm e2e` (11/11).
- No `Co-Authored-By`/Claude trailer in commits.
- **Write-tool gotcha:** strip a stray trailing `</content>` (`perl -0pi -e 's/\n?<\/content>\s*$//' <file>`) + `pnpm format`.

---

### Task 1: Pure helper — `buildTranslationInput` + `localeLabel`

**Files:**
- Create: `apps/web/lib/admin/translation-input.ts`
- Create: `apps/web/lib/admin/translation-input.test.ts`

**Interfaces:**
- Produces: `buildTranslationInput(fields: readonly string[], values: Record<string,string>) => Record<string,string>`; `localeLabel(locale: string) => string`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/admin/translation-input.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTranslationInput, localeLabel } from './translation-input';

describe('buildTranslationInput', () => {
  it('keeps only non-empty, trimmed, allowed fields', () => {
    const out = buildTranslationInput(['title', 'content', 'metaTitle'], {
      title: '  Hallo  ',
      content: '',
      metaTitle: ' Meta ',
      excerpt: 'ignored — not allowed',
    });
    expect(out).toEqual({ title: 'Hallo', metaTitle: 'Meta' });
  });

  it('returns an empty object when every field is blank (clears the override)', () => {
    expect(buildTranslationInput(['title', 'content'], { title: '   ', content: '' })).toEqual({});
  });
});

describe('localeLabel', () => {
  it('renders a friendly name with the code', () => {
    expect(localeLabel('de')).toBe('Deutsch (de)');
    expect(localeLabel('ru')).toBe('Русский (ru)');
    expect(localeLabel('xx')).toBe('xx (xx)');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run apps/web/lib/admin/translation-input.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `apps/web/lib/admin/translation-input.ts`:

```ts
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
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm vitest run apps/web/lib/admin/translation-input.test.ts`
Expected: PASS (5 assertions / 3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/admin/translation-input.ts apps/web/lib/admin/translation-input.test.ts
git commit -m "feat(web): pure helper for building translation override input"
```

---

### Task 2: Server Actions — post & page translation upsert/delete

**Files:**
- Modify: `apps/web/app/admin/posts/actions.ts`
- Modify: `apps/web/app/admin/pages/actions.ts`

**Interfaces:**
- Produces:
  - `upsertPostTranslationAction(id: string, locale: string, input: unknown): Promise<ActionResult>`
  - `deletePostTranslationAction(id: string, locale: string): Promise<ActionResult>`
  - `upsertPageTranslationAction(id: string, locale: string, input: unknown): Promise<ActionResult>`
  - `deletePageTranslationAction(id: string, locale: string): Promise<ActionResult>`
  - (`ActionResult` = `{ ok: true } | { ok: false; error: string }`, already defined in each file.)

- [ ] **Step 1: Add the post translation imports**

In `apps/web/app/admin/posts/actions.ts`, extend the config import:

```ts
import {
  type CreatePostInput,
  type UpdatePostInput,
  postTranslationInputSchema,
} from '@cmstack-ts/config';
```

- [ ] **Step 2: Add the post translation actions**

Append to `apps/web/app/admin/posts/actions.ts`:

```ts
export async function upsertPostTranslationAction(
  id: string,
  locale: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = postTranslationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the translation fields.' };
  try {
    await apiSend('PUT', `/posts/${id}/translations/${locale}`, parsed.data);
    revalidatePath('/admin/posts');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save translation' };
  }
}

export async function deletePostTranslationAction(
  id: string,
  locale: string,
): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/posts/${id}/translations/${locale}`);
    revalidatePath('/admin/posts');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to clear translation' };
  }
}
```

(If `ActionResult` in this file is the generic `ActionResult<T = undefined>`, the no-arg form
`ActionResult` already resolves to the void union — use it as written.)

- [ ] **Step 3: Add the page translation imports + actions**

In `apps/web/app/admin/pages/actions.ts`, extend the import:

```ts
import {
  type CreatePageInput,
  type UpdatePageInput,
  pageTranslationInputSchema,
} from '@cmstack-ts/config';
```

Append (mirror the post actions, using `pageTranslationInputSchema` + `/pages/...` +
`revalidatePath('/admin/pages')`):

```ts
export async function upsertPageTranslationAction(
  id: string,
  locale: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = pageTranslationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Please check the translation fields.' };
  try {
    await apiSend('PUT', `/pages/${id}/translations/${locale}`, parsed.data);
    revalidatePath('/admin/pages');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save translation' };
  }
}

export async function deletePageTranslationAction(
  id: string,
  locale: string,
): Promise<ActionResult> {
  try {
    await apiSend('DELETE', `/pages/${id}/translations/${locale}`);
    revalidatePath('/admin/pages');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to clear translation' };
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @cmstack-ts/web exec tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/posts/actions.ts apps/web/app/admin/pages/actions.ts
git commit -m "feat(web): server actions for post/page translation upsert + delete"
```

---

### Task 3: `TranslationsPanel` component

**Files:**
- Create: `apps/web/components/admin/translations-panel.tsx`

**Interfaces:**
- Consumes: `buildTranslationInput`/`localeLabel` (Task 1); the four actions (Task 2); `LOCALES`/`DEFAULT_LOCALE` from `@cmstack-ts/config`; existing `RichTextEditor`, `Button`, `Input`, `Label`, `Textarea`.
- Produces: `TranslationsPanel` (default export not used — named export), `TranslationField`, `TranslationRow` types.

- [ ] **Step 1: Implement the component**

Create `apps/web/components/admin/translations-panel.tsx`:

```tsx
'use client';

import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { buildTranslationInput, localeLabel } from '@/lib/admin/translation-input';
import { cn } from '@/lib/utils';
import { DEFAULT_LOCALE, LOCALES } from '@cmstack-ts/config';
import { Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

type ActionResult = { ok: true } | { ok: false; error: string };

export interface TranslationField {
  key: 'title' | 'excerpt' | 'content' | 'metaTitle' | 'metaDescription';
  label: string;
  type: 'input' | 'textarea' | 'richtext';
}

export interface TranslationRow {
  locale: string;
  title: string | null;
  excerpt?: string | null;
  content: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

interface TranslationsPanelProps {
  entityId: string;
  base: Record<string, string>;
  translations: TranslationRow[];
  fields: TranslationField[];
  upsertAction: (id: string, locale: string, input: Record<string, string>) => Promise<ActionResult>;
  deleteAction: (id: string, locale: string) => Promise<ActionResult>;
}

const OVERRIDE_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

function rowValues(row: TranslationRow | undefined, fields: TranslationField[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = (row as Record<string, string | null | undefined> | undefined)?.[f.key];
    out[f.key] = v ?? '';
  }
  return out;
}

export function TranslationsPanel({
  entityId,
  base,
  translations,
  fields,
  upsertAction,
  deleteAction,
}: TranslationsPanelProps) {
  const [active, setActive] = useState(OVERRIDE_LOCALES[0] ?? DEFAULT_LOCALE);
  // Per-locale editable field values, seeded from existing rows.
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() => {
    const seed: Record<string, Record<string, string>> = {};
    for (const locale of OVERRIDE_LOCALES) {
      seed[locale] = rowValues(
        translations.find((t) => t.locale === locale),
        fields,
      );
    }
    return seed;
  });
  const [isPending, startTransition] = useTransition();

  if (OVERRIDE_LOCALES.length === 0) return null;

  const current = values[active] ?? {};
  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [active]: { ...prev[active], [key]: value } }));
  }

  function save() {
    const input = buildTranslationInput(
      fields.map((f) => f.key),
      current,
    );
    startTransition(async () => {
      const res = await upsertAction(entityId, active, input);
      res.ok ? toast.success(`Translation saved (${active})`) : toast.error(res.error);
    });
  }

  function clear() {
    startTransition(async () => {
      const res = await deleteAction(entityId, active);
      if (res.ok) {
        setValues((prev) => ({
          ...prev,
          [active]: Object.fromEntries(fields.map((f) => [f.key, ''])),
        }));
        toast.success(`Translation cleared (${active})`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <section className="max-w-3xl mx-auto px-6 pb-10 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Translations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Per-locale overrides. Leave a field blank to fall back to the default-language value.
        </p>
      </div>

      {/* Locale tab strip */}
      <div className="flex gap-1 border-b border-border" role="tablist">
        {OVERRIDE_LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            role="tab"
            aria-selected={active === locale}
            onClick={() => setActive(locale)}
            className={cn(
              'px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
              active === locale
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {localeLabel(locale)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`tr-${active}-${field.key}`}>{field.label}</Label>
            {field.type === 'richtext' ? (
              <RichTextEditor
                value={current[field.key] ?? ''}
                onChange={(v) => setField(field.key, v)}
                placeholder={base[field.key] || 'Falls back to the default language'}
              />
            ) : field.type === 'textarea' ? (
              <Textarea
                id={`tr-${active}-${field.key}`}
                value={current[field.key] ?? ''}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={base[field.key] || 'Falls back to the default language'}
                rows={3}
              />
            ) : (
              <Input
                id={`tr-${active}-${field.key}`}
                value={current[field.key] ?? ''}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={base[field.key] || 'Falls back to the default language'}
              />
            )}
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button size="sm" disabled={isPending} onClick={save}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save {active} translation
          </Button>
          <Button variant="outline" size="sm" disabled={isPending} onClick={clear}>
            Clear {active} translation
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm --filter @cmstack-ts/web exec tsc --noEmit && pnpm lint`
Expected: clean. (If lint flags the ternary `res.ok ? ... : ...` expression statement, convert to an `if/else`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/translations-panel.tsx
git commit -m "feat(web): reusable per-locale TranslationsPanel"
```

---

### Task 4: Wire the panel into the post & page edit pages

**Files:**
- Modify: `apps/web/app/admin/posts/[id]/edit/page.tsx`
- Modify: `apps/web/app/admin/pages/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `TranslationsPanel`/`TranslationField` (Task 3); the four actions (Task 2).

- [ ] **Step 1: Wire the post edit page**

In `apps/web/app/admin/posts/[id]/edit/page.tsx`, add imports and render the panel after `<PostForm>`:

```tsx
import { TranslationsPanel, type TranslationField } from '@/components/admin/translations-panel';
import {
  deletePostTranslationAction,
  updatePostAction,
  upsertPostTranslationAction,
} from '../../actions';

const POST_FIELDS: TranslationField[] = [
  { key: 'title', label: 'Title', type: 'input' },
  { key: 'excerpt', label: 'Excerpt', type: 'textarea' },
  { key: 'content', label: 'Content', type: 'richtext' },
  { key: 'metaTitle', label: 'Meta title', type: 'input' },
  { key: 'metaDescription', label: 'Meta description', type: 'textarea' },
];
```

Replace the single returned `<PostForm .../>` with a fragment:

```tsx
  return (
    <>
      <PostForm post={post} categories={categories} tags={tags} updateAction={updatePostAction} />
      <TranslationsPanel
        entityId={post.id}
        base={{
          title: post.title,
          excerpt: post.excerpt ?? '',
          content: post.content ?? '',
          metaTitle: post.metaTitle ?? '',
          metaDescription: post.metaDescription ?? '',
        }}
        translations={post.translations}
        fields={POST_FIELDS}
        upsertAction={upsertPostTranslationAction}
        deleteAction={deletePostTranslationAction}
      />
    </>
  );
```

- [ ] **Step 2: Wire the page edit page**

In `apps/web/app/admin/pages/[id]/edit/page.tsx`, add imports and render the panel (no `excerpt`):

```tsx
import { TranslationsPanel, type TranslationField } from '@/components/admin/translations-panel';
import {
  deletePageTranslationAction,
  updatePageAction,
  upsertPageTranslationAction,
} from '../../actions';

const PAGE_FIELDS: TranslationField[] = [
  { key: 'title', label: 'Title', type: 'input' },
  { key: 'content', label: 'Content', type: 'richtext' },
  { key: 'metaTitle', label: 'Meta title', type: 'input' },
  { key: 'metaDescription', label: 'Meta description', type: 'textarea' },
];
```

Replace the returned `<PageForm .../>`:

```tsx
  return (
    <>
      <PageForm page={page} updateAction={updatePageAction} />
      <TranslationsPanel
        entityId={page.id}
        base={{
          title: page.title,
          content: page.content ?? '',
          metaTitle: page.metaTitle ?? '',
          metaDescription: page.metaDescription ?? '',
        }}
        translations={page.translations}
        fields={PAGE_FIELDS}
        upsertAction={upsertPageTranslationAction}
        deleteAction={deletePageTranslationAction}
      />
    </>
  );
```

(Confirm the exact base field names against `PageDetail`/`PostDetail` — e.g. `metaTitle`/
`metaDescription`/`content` are nullable strings; coalesce with `?? ''`.)

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm --filter @cmstack-ts/web exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/admin/posts/[id]/edit/page.tsx" "apps/web/app/admin/pages/[id]/edit/page.tsx"
git commit -m "feat(web): mount TranslationsPanel on post + page edit screens"
```

---

### Task 5: Full gates, live verification, adversarial review, HANDOFF

**Files:**
- Modify: `cmstack-ts/HANDOFF.md`, `cmstack-ts/REFACTOR_PLAN.md` (§7 #8 tick)

- [ ] **Step 1: Run the full unit gates**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm vitest run --coverage   # ≥80% must hold
```

Expected: green; record real counts.

- [ ] **Step 2: Live verification (HANDOFF recipe)**

Bring the stack up (db + built api + web), log in to the admin, open a post's edit screen:
- The Translations panel shows `de`/`ru` tabs; existing seeded de/ru overrides pre-fill.
- Edit the `de` title + content → Save → toast; `curl -s 'localhost:3000/de/blog/<slug>'` shows
  the de override, `localhost:3000/blog/<slug>` shows en, a blank field falls back to en.
- Clear the `de` translation → `curl` shows en everywhere for de again.
- `pnpm e2e` → 11/11.

- [ ] **Step 3: Adversarial self-review (inline, no parallel agents)**

Check: locale param is validated server-side (`localeSchema`) so a junk tab can't inject; the
panel only renders in edit mode (id present); empty fields omitted → fall back (not stored as
empty overrides); clearing resets local state and calls idempotent DELETE; admin stays English;
`revalidatePath('/', 'layout')` refreshes the public localized surfaces; content is still
server-sanitized on the API (the panel sends raw HTML to the same sanitized PUT path). Fix any
finding with a test.

- [ ] **Step 4: Update HANDOFF + tick §7 #8**

Add a "§7 #8 — DONE" block to `HANDOFF.md` and tick #8 in `REFACTOR_PLAN.md` §7. Update the
continuation prompt's next item to #9 (plugin admin UI).

- [ ] **Step 5: Final commit**

```bash
git add cmstack-ts/HANDOFF.md cmstack-ts/REFACTOR_PLAN.md
git commit -m "feat: dashboard translation editing UI (Task 1 §7 #8)"
```

---

## Self-Review

**Spec coverage:**
- Pure helper (`buildTranslationInput`/`localeLabel`) → Task 1. ✓
- Server actions (post+page upsert/delete) → Task 2. ✓
- `TranslationsPanel` (tab strip, fallback placeholders, per-locale Save/Clear, RichTextEditor) → Task 3. ✓
- Wire into both edit pages (post incl. excerpt, page without) → Task 4. ✓
- Gates + live + adversarial + HANDOFF → Task 5. ✓
- Out-of-scope (Category/Tag, slug/taxonomy, machine translation) → documented in spec; nothing to build. ✓

**Placeholder scan:** Task 4 Step 2 asks to confirm base field names against the detail types — the action (coalesce with `?? ''`) is concrete. All component/action steps carry full code. No TBD/TODO.

**Type consistency:** `TranslationField`/`TranslationRow`, `buildTranslationInput`/`localeLabel`,
`upsert{Post,Page}TranslationAction`/`delete{Post,Page}TranslationAction`, and `ActionResult`
(`{ok:true}|{ok:false;error}`) are spelled identically across Tasks 1–4. `OVERRIDE_LOCALES`
(`LOCALES.filter(!== DEFAULT_LOCALE)`) is the single source for the tabs.
