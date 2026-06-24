# Per-locale content translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translatable Post/Page title/excerpt/body/meta per locale (de/ru) over base-en columns, with per-field fallback and locale-aware public reads.

**Architecture:** B3 model — base `Post`/`Page` columns are the canonical `en` values; new `PostTranslation`/`PageTranslation` tables hold de/ru overrides (nullable fields, per-field fallback). Reads overlay translation onto base via a pure resolver before the existing DTO mappers; admin writes translations through CASL-gated sub-resource endpoints. Three-layer pattern preserved (controller → service → repository).

**Tech Stack:** NestJS 10 (CJS), Prisma 6 + Postgres, Next.js 15 (ESM), Zod (`@cmstack-ts/config`), Vitest, Biome.

## Global Constraints

- Locales: `['en','de','ru']`, default `en`. Single source in `@cmstack-ts/config`.
- Repos framework-free; never catch `P2002`/`P2025`; `$transaction` array form; HTTP mapping + sanitize stay in services (`REFACTOR_PLAN.md` §2.0/§2.4/§10).
- Import model + repo types from `@cmstack-ts/db`, never `@prisma/client`.
- No observer events this slice (§2.7 — no genuine side effect).
- Translation `content` HTML sanitized server-side on every write (CLAUDE.md Content rules).
- Coverage gate ≥80% must stay green. Reply to operator in Russian; code/docs English.
- **Write-tool gotcha:** strip stray `</content>` (`perl -0pi -e 's/\n?<\/content>\s*$//' <file>`) + `pnpm format` before testing.

---

### Task 1: Config — locales + schemas

**Files:**
- Modify: `packages/config/src/content.ts`
- Create: `packages/config/src/locale.ts`
- Modify: `packages/config/src/index.ts` (re-export)
- Modify: `apps/web/i18n/routing.ts` (import LOCALES/DEFAULT_LOCALE)
- Test: `packages/config/src/locale.test.ts`, extend `packages/config/src/content.test.ts` if present (else create)

**Interfaces:**
- Produces: `LOCALES: readonly ['en','de','ru']`, `DEFAULT_LOCALE: 'en'`, `localeSchema = z.enum(LOCALES)`, type `Locale`.
- Produces: `createPostSchema`/`createPageSchema` gain optional `metaTitle` (≤200), `metaDescription` (≤300).
- Produces: `postTranslationInputSchema`, `pageTranslationInputSchema` (all optional), `postTranslationSchema`, `pageTranslationSchema` (output, nullable fields). `postDetailSchema`/`pageDetailSchema` gain `metaTitle`/`metaDescription` nullable + `translations` array.

- [ ] **Step 1: Write failing test** `packages/config/src/locale.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALES, localeSchema } from './locale';
describe('locale', () => {
  it('lists en/de/ru with en default', () => {
    expect(LOCALES).toEqual(['en', 'de', 'ru']);
    expect(DEFAULT_LOCALE).toBe('en');
  });
  it('rejects junk', () => {
    expect(localeSchema.safeParse('xx').success).toBe(false);
    expect(localeSchema.safeParse('de').success).toBe(true);
  });
});
```
- [ ] **Step 2: Run, verify fail** — `pnpm vitest run packages/config/src/locale.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `packages/config/src/locale.ts`:
```ts
import { z } from 'zod';
export const LOCALES = ['en', 'de', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const localeSchema = z.enum(LOCALES);
```
- [ ] **Step 4: Add meta + translation schemas** to `packages/config/src/content.ts` (after the Posts/Pages blocks):
```ts
// meta added to create schemas
// in createPostSchema object add:  metaTitle: z.string().trim().max(200).optional(), metaDescription: z.string().trim().max(300).optional(),
// in createPageSchema object add the same two.

// --- Translations -----------------------------------------------------------
export const postTranslationInputSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  excerpt: z.string().trim().max(500).optional(),
  content: z.string().optional(),
  metaTitle: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(300).optional(),
});
export type PostTranslationInput = z.infer<typeof postTranslationInputSchema>;
export const pageTranslationInputSchema = postTranslationInputSchema.omit({ excerpt: true });
export type PageTranslationInput = z.infer<typeof pageTranslationInputSchema>;

export const postTranslationSchema = z.object({
  locale: z.string(),
  title: z.string().nullable(),
  excerpt: z.string().nullable(),
  content: z.string().nullable(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
});
export const pageTranslationSchema = postTranslationSchema.omit({ excerpt: true });
```
Extend `postDetailSchema` with `.extend({ metaTitle: z.string().nullable(), metaDescription: z.string().nullable(), translations: z.array(postTranslationSchema) })` and `pageDetailSchema` similarly (with `pageTranslationSchema`). Add nullable `metaTitle`/`metaDescription` to `postSummarySchema`? No — summary unchanged. Public post detail = `postDetailSchema` already (shared admin+public) — keep meta nullable there.
- [ ] **Step 5: Re-export** in `packages/config/src/index.ts`: add `LOCALES, DEFAULT_LOCALE, localeSchema, type Locale`, and the new translation schemas/types.
- [ ] **Step 6: Wire web routing** `apps/web/i18n/routing.ts`: `import { LOCALES, DEFAULT_LOCALE } from '@cmstack-ts/config';` → `locales: [...LOCALES], defaultLocale: DEFAULT_LOCALE`. Keep `localePrefix: 'as-needed'` and the `Locale` type export.
- [ ] **Step 7: Run config tests + build packages** — `pnpm vitest run packages/config` PASS; `pnpm --filter @cmstack-ts/config build` clean.
- [ ] **Step 8: Strip Write artifact + format + commit**:
```bash
perl -0pi -e 's/\n?<\/content>\s*$//' packages/config/src/locale.ts
pnpm format && git add -A && git commit -m "feat(config): locale source + translation/meta schemas"
```

---

### Task 2: Prisma schema + migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: migration dir under `packages/db/prisma/migrations/`

**Interfaces:**
- Produces: `Post.metaTitle/metaDescription/translations`, `Page.metaTitle/metaDescription/translations`, `PostTranslation`, `PageTranslation` models with `@@unique([postId|pageId, locale])`.

- [ ] **Step 1: Edit schema** — add to `Post` (before `@@index`): `metaTitle String?`, `metaDescription String?`, `translations PostTranslation[]`. Add to `Page`: `metaTitle String?`, `metaDescription String?`, `translations PageTranslation[]`. Append the two translation models (see spec data-model block verbatim).
- [ ] **Step 2: Create migration** (DB up from earlier):
```bash
DATABASE_URL="postgresql://typress:typress@localhost:5432/typress?schema=public" \
  pnpm --filter @cmstack-ts/db exec prisma migrate dev --name content_translations
```
Expected: new migration applied, client regenerated.
- [ ] **Step 3: Verify reversibility** — read the generated `migration.sql`; confirm it is additive (CREATE TABLE + ALTER TABLE ADD COLUMN only). Down = drop tables + columns.
- [ ] **Step 4: Build db package** — `pnpm --filter @cmstack-ts/db build` clean (tsc sees new types).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(db): PostTranslation/PageTranslation tables + base meta columns"`.

---

### Task 3: PostRepository — localized reads + translation writes

**Files:**
- Modify: `packages/db/src/repositories/post.repository.ts`
- Test: `packages/db/src/repositories/post.repository.spec.ts` (extend)

**Interfaces:**
- Consumes: `Locale`, `DEFAULT_LOCALE`, `PostTranslationInput` from `@cmstack-ts/db`/`@cmstack-ts/config`.
- Produces on `PostRepository`:
  - `findPublicBySlug(slug: string, locale: Locale): Promise<PostWithRelations | null>`
  - `listAndCount(filter: PostListFilter, locale: Locale): Promise<{ items: PostWithRelations[]; total: number }>`
  - `publicByAuthor(authorId: string, locale: Locale): Promise<PostWithRelations[]>`
  - `findByIdWithTranslations(id: string): Promise<PostWithTranslations | null>`
  - `upsertTranslation(postId: string, locale: Locale, data: PostTranslationInput): Promise<void>`
  - `deleteTranslation(postId: string, locale: Locale): Promise<void>`
- `PostWithRelations` include gains `translations` (filtered by locale at query time); export `localizedPostInclude(locale)` helper + `PostWithTranslations` payload alias (all translations).

- [ ] **Step 1: Write failing contract tests** (mocked PrismaClient delegate). Key assertions:
  - `findPublicBySlug('s','de')` calls `post.findUnique`/`findFirst` with `include.translations = { where: { locale: 'de' } }`; for `'en'` the include has **no** `translations` (identical to today).
  - `listAndCount(filter,'ru')` adds `include.translations: { where: { locale: 'ru' } }`; `'en'` unchanged; still `$transaction([findMany,count])` array form.
  - `upsertTranslation('p','de',{title:'T'})` calls `postTranslation.upsert({ where: { postId_locale: { postId:'p', locale:'de' } }, create:{...,postId:'p',locale:'de'}, update:{...} })`.
  - `deleteTranslation('p','de')` calls `postTranslation.delete({ where: { postId_locale: { postId:'p', locale:'de' } } })`.
- [ ] **Step 2: Run, verify fail** — `pnpm vitest run packages/db/src/repositories/post.repository.spec.ts` → FAIL.
- [ ] **Step 3: Implement** — add `localizedPostInclude(locale)` (= `postInclude` spread + `translations: locale === DEFAULT_LOCALE ? false : { where: { locale } }`); change the three finders to take `locale` and use it; add `findByIdWithTranslations` (`include: { ...postInclude, translations: true }`); add upsert/delete using the `postId_locale` compound unique. No try/catch on Prisma errors.
- [ ] **Step 4: Run tests** PASS; `pnpm --filter @cmstack-ts/db build` clean.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): PostRepository localized reads + translation upsert/delete"`.

---

### Task 4: PageRepository — localized reads + translation writes

**Files:**
- Modify: `packages/db/src/repositories/page.repository.ts`
- Test: `packages/db/src/repositories/page.repository.spec.ts` (extend)

**Interfaces:**
- Produces on `PageRepository`: `findPublicBySlug(slug, locale)`, `findByIdWithTranslations(id)`, `upsertTranslation(pageId, locale, data: PageTranslationInput)`, `deleteTranslation(pageId, locale)`. `localizedPageInclude(locale)` + `PageWithTranslations`.

- [ ] **Step 1–5:** Mirror Task 3 for Page (no `excerpt`, no `publicByAuthor`, no `listAndCount` locale param — pages `list()` is admin-only and stays en; public pages are single-slug). Tests assert the same include/upsert/delete shapes on `pageTranslation` with `pageId_locale`. Commit `feat(db): PageRepository localized read + translation upsert/delete`.

---

### Task 5: Pure localize resolver

**Files:**
- Create: `apps/api/src/content/localize.ts`
- Test: `apps/api/src/content/localize.spec.ts`

**Interfaces:**
- Produces: `localizeContent<T extends Record<string, unknown>>(base: T, translation: Partial<T> | null | undefined, fields: readonly (keyof T)[]): T` — returns `{ ...base, field: translation?.field ?? base.field }` per listed field where the translation value is non-null/undefined.

- [ ] **Step 1: Failing test**:
```ts
import { localizeContent } from './localize';
it('overlays non-null translated fields, falls back per field', () => {
  const base = { title: 'EN', excerpt: 'e', content: 'c' };
  expect(localizeContent(base, { title: 'DE', excerpt: null }, ['title','excerpt','content']))
    .toEqual({ title: 'DE', excerpt: 'e', content: 'c' });
});
it('null translation returns base', () => {
  const base = { title: 'EN' };
  expect(localizeContent(base, null, ['title'])).toEqual(base);
});
```
- [ ] **Step 2: Verify fail.** **Step 3: Implement** the pure function (no imports). **Step 4: PASS.** **Step 5: Commit** `feat(api): pure localize resolver`.

---

### Task 6: PostsService — locale-aware reads + translation writes

**Files:**
- Modify: `apps/api/src/content/posts.service.ts`, `apps/api/src/content/posts.controller.ts`, `apps/api/src/content/public-content.controller.ts`
- Test: `apps/api/src/content/posts.service.spec.ts` (extend), controllers covered via service fakes

**Interfaces:**
- Consumes: PostRepository new methods, `localizeContent`, `HtmlSanitizerService`, `localeSchema`.
- Produces: `PostsService.findPublicBySlug(slug, locale)`, `list(query, { publicOnly }, locale)`, `publicByAuthor(authorId, locale)`, `getOneWithTranslations(id)` (admin GET returns `translations`), `upsertTranslation(id, locale, input, authorId)`, `deleteTranslation(id, locale)`.

- [ ] **Step 1: Failing service tests** (fake repo typed `Record<keyof PostRepository, Mock>`):
  - `findPublicBySlug('s','de')` passes `'de'` to `repo.findPublicBySlug` and the returned detail uses `translation.title` when present, base title when translation null (assert via fake returning a post with a `translations:[{locale:'de',title:'DE',content:null,...}]`).
  - `upsertTranslation('p','de',{ content:'<script>x</script><b>ok</b>' },'u')` → sanitizer called on content; `repo.upsertTranslation` receives sanitized content; passthrough title/meta.
  - `upsertTranslation` with an all-empty input → `repo.deleteTranslation` called (clear semantics).
  - `findPublicBySlug` returns `null` → service throws `NotFoundException`.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement service** — public reads accept `locale`, run each post through `localizeContent(post, post.translations?.[0] ?? null, ['title','excerpt','content','metaTitle','metaDescription'])` before `toSummary`/`toDetail`. `upsertTranslation`: sanitize `content` if present; if every field is empty/undefined → `repo.deleteTranslation`; else `repo.upsertTranslation`. 404 when base post missing (use `repo.exists`/find). No hook emit.
- [ ] **Step 4: Wire controllers** — `PublicContentController` parse `?locale=` with `localeSchema.catch(DEFAULT_LOCALE)` (or safeParse → default); pass to service. `PostsController`: add
```ts
@Put(':id/translations/:locale') @CheckPolicies((a) => a.can('update', 'Post'))
upsertTranslation(@Param('id') id, @Param('locale', new ZodValidationPipe(localeSchema)) locale, @Body(new ZodValidationPipe(postTranslationInputSchema)) body, @CurrentUser() user) { return this.posts.upsertTranslation(id, locale, body, user.id); }
@Delete(':id/translations/:locale') ...deleteTranslation
```
`GET /posts/:id` returns `getOneWithTranslations`.
- [ ] **Step 5: Run** `pnpm vitest run apps/api/src/content/posts.service.spec.ts` PASS; `pnpm typecheck` clean.
- [ ] **Step 6: Commit** `feat(api): locale-aware Posts reads + translation endpoints`.

---

### Task 7: PagesService — locale-aware read + translation writes

**Files:**
- Modify: `apps/api/src/content/pages.service.ts`, `pages.controller.ts`, `public-content.controller.ts`
- Test: `apps/api/src/content/pages.service.spec.ts` (extend)

- [ ] Mirror Task 6 for pages: `findPublicBySlug(slug, locale)` overlays `['title','content','metaTitle','metaDescription']`; `upsertTranslation`/`deleteTranslation`/`getOneWithTranslations`; controller routes `PUT/DELETE /pages/:id/translations/:locale` (`pageTranslationInputSchema`), public `?locale=`. Tests for fallback, sanitize, clear, 404. Commit `feat(api): locale-aware Pages read + translation endpoints`.

---

### Task 8: Authors service locale passthrough

**Files:**
- Modify: `apps/api/src/content/authors.service.ts`, `authors.controller.ts`, `public-content.controller.ts` (or wherever `/public/authors/:id` lives)
- Test: `apps/api/src/content/authors.service.spec.ts` (extend if present)

- [ ] `AuthorsService.getProfile(id, locale)` forwards locale to `posts.publicByAuthor(authorId, locale)`; controller reads `?locale=`. Test asserts locale reaches `publicByAuthor`. Commit `feat(api): localize author profile posts`.

---

### Task 9: Web public — forward locale

**Files:**
- Modify: `apps/web/app/[locale]/blog/page.tsx`, `apps/web/app/[locale]/blog/[slug]/page.tsx`, `apps/web/app/[locale]/authors/[id]/page.tsx`, any `app/[locale]/pages/[slug]` route, plus the page-by-slug fetch used by the active theme if separate.

- [ ] **Step 1:** In each fetch, append `?locale=${locale}` (the route param is already in scope). For the blog index list, `?perPage=20&locale=${locale}`. **Step 2:** `pnpm --filter @cmstack-ts/web build` clean. **Step 3:** Commit `feat(web): forward active locale to public content API`.

---

### Task 10: Seed demo translations

**Files:**
- Modify: `packages/db/prisma/seed.ts`

- [ ] Add idempotent `postTranslation.upsert` (de + ru) for 1–2 demo posts and one `pageTranslation.upsert` for a page, keyed on the compound unique. Run `DATABASE_URL=... pnpm db:seed`; verify `GET /public/posts/<slug>?locale=de` returns the translated title (curl). Commit `feat(db): seed de/ru demo translations`.

---

### Task 11: Full gates + adversarial review

- [ ] **Step 1:** `pnpm test` (all green), `pnpm typecheck`, `pnpm lint`, `pnpm vitest run --coverage` (≥80% gate exits 0). Show real output.
- [ ] **Step 2:** Rebuild + re-run `pnpm e2e` (full stack) — still green; add an e2e asserting `/de/blog/<slug>` shows translated title if cheap.
- [ ] **Step 3:** Dispatch 2–3 independent adversarial Opus skeptics (behaviour / security): (a) no email/private field leaked via the translation include or author posts; (b) sanitize applied to every translated content write; (c) per-field fallback correctness + en path byte-identical; (d) CASL gates translation writes; (e) repo never catches P2002/P2025. Fix real findings, re-run gates.
- [ ] **Step 4:** Update `HANDOFF.md` (Task 1 #1 done) + commit.

## Self-Review notes
- Spec coverage: schema (T2), config/locales+meta (T1), repo localized reads + translation writes (T3/T4), resolver (T5), services + controllers + public locale (T6/T7), authors (T8), web forward (T9), seed (T10), gates+review+search-limitation-noted (T11). Deferred items (admin tab-strip #8, meta render #2, multilingual search) intentionally absent.
- Types consistent: `localizeContent` signature, `upsertTranslation(id, locale, data)`, compound unique `postId_locale`/`pageId_locale` used uniformly.
- Search de/ru not indexed — documented limitation, logged in T11, not silently dropped.
