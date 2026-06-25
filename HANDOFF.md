# cmstack-ts — HANDOFF

**Updated:** 2026-06-25 — **Task 2 + Task 4 COMPLETE; E2E re-run green; Task 1 IN PROGRESS (§7 #1, #2, #3 done).** · **Branch:** `refactor/repository-layer` (off `main`)
**Next phases:** Task 1 (feature parity) continuing per §7 order (next: #4 menu management); Task 3 (UI), Task 5 (README) not started.

## Task 1 progress (feature parity, `REFACTOR_PLAN.md` §7 — strict order per operator)
- **E2E baseline re-run (pre-Task-1):** full stack up (docker db + built api + built web),
  `pnpm e2e` = **11/11 green** → repository-layer refactor confirmed black-box-invariant.
  One pre-existing i18n/a11y drift fixed on the way (search input `aria-label` now a distinct
  `search.inputLabel` = "Search query"; the e2e test predated the i18n foundation).
- **§7 #1 — Per-locale content translation (Post + Page): DONE.** Model B3 (operator-chosen):
  base Post/Page columns are the canonical **en** values; new `PostTranslation`/`PageTranslation`
  tables hold de/ru overrides (nullable fields, **per-field fallback**); shared slug/status/author.
  Spec: `docs/superpowers/specs/2026-06-24-per-locale-content-translation-design.md`; plan:
  `docs/superpowers/plans/2026-06-24-per-locale-content-translation.md`.
  - Additive reversible migration `20260624205514_content_translations` (+ base `metaTitle`/
    `metaDescription` on Post/Page — translatable meta folded in now so §7 #2 won't re-migrate).
  - `@cmstack-ts/config` owns `LOCALES`/`DEFAULT_LOCALE`/`localeSchema` (web i18n routing imports
    them — no drift) + translation/meta schemas. Pure `localizeContent` resolver (unit-tested).
  - Repos gained locale-aware finders (`localizedPostInclude`/`localizedPageInclude`) +
    `findByIdWithTranslations` + full-row `upsertTranslation`/`deleteTranslation` on the
    `[contentId, locale]` unique; repos stay framework/config-free, never catch P2002/P2025.
  - Public reads take `?locale=` (junk/absent → default); admin GET returns all translation rows;
    CASL-gated `PUT/DELETE /{posts,pages}/:id/translations/:locale` (content sanitized; empty field
    = no override → falls back; all-empty save clears the row; idempotent delete). No observer
    events (§2.7 — no real side effect). Authors profile + web blog/post/author pages forward locale.
  - Seed adds de/ru demo translations. **Verified live** (curl + SSR): en base, de/ru overlay with
    per-field fallback, junk locale → en. **301 tests, typecheck/lint clean, coverage ≥80%, e2e 11/11.**
  - Adversarial self-review found + fixed **1 MED bug** (empty-string field overlaid base instead of
    falling back) with a regression test.
  - **Scoped out (logged, not silent):** admin per-locale tab-strip UI → §7 #8; meta `<head>` render +
    canonical/noindex → §7 #2 (columns already in place); multilingual de/ru full-text search → future
    (canon rates ts search non-multilingual); Category/Tag name translation → fast-follow.
- **§7 #2 — Per-content SEO meta: DONE** (2026-06-25). Structural `canonicalUrl` + `noindex` added
  to Post/Page (migration `20260625..._content_seo_meta`, additive/reversible; NOT per-locale).
  metaTitle/metaDescription were already translatable from #1. Surfacing: blog post `generateMetadata`
  uses **localized** metaTitle/metaDescription over title/excerpt, applies a custom canonical override,
  emits robots `noindex` (index:false, follow kept); `noindex` posts are excluded from the **sitemap**
  and **llms.txt**. Admin post + page forms gained an **SEO fieldset** (meta title/description,
  canonical URL, noindex checkbox). **302 tests, typecheck/lint clean, coverage ≥80%, e2e 11/11**;
  live-verified (custom `<title>`/description/canonical render, `noindex,follow` meta, sitemap excludes
  the noindex post). Adversarial self-review fixed one SEO nit (`noindex` no longer implies `nofollow`).
  - **Known pre-existing limitation (not a #2 regression):** the admin forms send empty optional fields
    as `undefined`, so clearing an existing excerpt/meta/canonical via the form is a no-op (the value
    persists). Systemic to the form pattern (excerpt already behaved this way); fix later by sending an
    explicit empty/`null` if field-clearing is required.
  - **Pages** store meta/canonical/noindex but have **no public route** yet, so page-level meta is not
    rendered anywhere (wire it when pages get a public surface).
- **§7 #3 — Password reset + transactional email: DONE** (2026-06-25). New `mail` module:
  `MailService` sends through a pluggable `MailTransport` (real SMTP via **nodemailer** when
  `SMTP_HOST` is set; a logging no-op otherwise, so the demo prints the reset link to the API log
  and needs no SMTP server) + a pure `passwordResetEmail` builder (HTML-escaped link).
  `PasswordResetToken` model (migration `20260625..._password_reset_tokens`): only the **SHA-256
  hash** of the token is stored, single-use (`usedAt`), TTL (`PASSWORD_RESET_TTL_MINUTES`, default
  60). Rate-limited `POST /auth/password-reset/request` (always 200 — no account enumeration; a mail
  failure is caught so it can't 500-leak existence) and `/confirm` (validates token unused+unexpired,
  Argon2id-rehashes, marks used). Web `/forgot-password` + `/reset-password?token=` pages (outside
  locale routing; added to middleware `PANEL_PREFIXES`) + a "Forgot your password?" link on sign-in.
  `.env.example` documents the SMTP vars. **316 tests, typecheck/lint clean, coverage ≥80%, e2e
  11/11**; live-verified end-to-end (request → emailed link from the API log → confirm → login with
  the new password; reuse of a spent token → 400). Adversarial self-review fixed the mail-failure
  enumeration leak (above).
  - **New dependency:** `nodemailer` (+ `@types/nodemailer`) in `apps/api` — required for real SMTP
    delivery; justified by the feature (not speculative).
- **Next §7 item:** **#4 — menu management** (admin drag-sortable builder; items reference
  posts/pages/categories/custom URLs; per-locale; public rendering).

---

## What this work is
Bring `cmstack-ts` to the shared cross-stack standard. The active sub-task is the
**repository-layer refactor**: extract all Prisma access out of the NestJS services in
`apps/api` into per-aggregate repositories in `packages/db`, wired via DI. Full plan +
decision record: **`REFACTOR_PLAN.md`** (read it first). Canon specs (read-only, do
NOT edit): `../FEATURE_MATRIX.md`, `../DESIGN_SYSTEM.md`.

## Architecture (target, three layers — operator-enforced)
`controller (thin) → service (business logic + emits observer events on real side
effects) → repository (data access, framework-free, returns Prisma payloads)`.
- Repositories live in `packages/db/src/repositories/`, one file per aggregate:
  export `interface XRepository`, `X_REPOSITORY` Symbol token, `PrismaXRepository`.
  Re-exported from `packages/db/src/index.ts` (which now also `export * from
  '@prisma/client'` so the API never imports `@prisma/client` directly).
- Each feature module binds its token via `{ provide: X_REPOSITORY, useFactory:
  (p: PrismaClient) => new PrismaXRepository(p), inject: [PRISMA] }`. **No @Global
  god-module.** `PRISMA` token is in `apps/api/src/prisma/prisma.module.ts`.
- **Observer policy (operator decision):** service emits domain events via
  `HookRegistry` only where a write has a genuine side effect (see plan §2.7 event
  map). Repository never touches `HookRegistry`. No speculative events.
- **Behaviour preservation is non-negotiable** — see `REFACTOR_PLAN.md` §10
  invariants (connect-vs-set, media ordering, repos never catch P2002/P2025,
  $transaction array form, raw-SQL binding, 4 distinct user shapes, asymmetric
  upserts, revision/publish ordering).

## DONE
- **Baseline pinned:** `pnpm test` = 27 files / 134 tests green (now **140** after the
  Settings slice).
- **`REFACTOR_PLAN.md`** written, adversarially reviewed (2 independent skeptics:
  over-engineering + behaviour-preservation), revised; observer policy + fat-controller
  finding integrated.
- **Premise corrected:** controllers were NOT fat — 18/19 already thin; services held
  logic; only the repository layer was missing. **One genuine fat controller found:**
  `apps/api/src/admin/admin.controller.ts` (injects PrismaClient, runs
  `Promise.all([user.count, role.count])`) — fix planned in plan §4.10b (AdminService +
  repo counts), scheduled with the Auth domain.
- **Scaffolding committed:** `packages/db/src/repositories/` (barrel, `crud.repository.ts`
  base, per-aggregate files), `packages/db/src/index.ts` re-exports the Prisma surface
  + repositories, and `apps/api/src/persistence/repository.providers.ts`
  (`provideRepository(token, Impl)` DI helper).
- **7 domains refactored, each its own commit (TDD, full suite green, tsc + biome clean):**
  1. **Settings** → `SettingRepository`.
  2. **SEO/GEO** → `SiteProfile` + `Service` + `Faq` repositories (asymmetric upsert).
  3. **Tags** + **Categories** → repos + `PrismaCrudRepository` base; `findIdBySlug`
     keeps the uniqueSlug excludeId loop; Category unchecked scalar `parentId`.
  4. **Media** → `MediaRepository` (storage/DB ordering + rollback pinned by tests).
  5. **Likes** → `PostLikeRepository` + incremental `PostRepository.findPublishedIdBySlug`
     (race-resilient toggle preserved; repos never catch P2002/P2025).
  6. **Comments** → `CommentRepository` (email never selected; status filter; post include);
     reuses `PostRepository.findPublishedIdBySlug`.
- **Adversarial review** of the simple-CRUD batch (Settings/SEO/Tags/Categories): two
  independent skeptics — behaviour-preservation found **0** issues; correctness found only
  minors (one type-honesty nit fixed).
- **ALL 12 service domains now refactored** (added after the 7-domain checkpoint):
  Media, Likes, Comments, Search, Pages, Posts (+Revisions), and Auth (Users/Accounts/
  Roles). The **one genuine fat controller** (`admin.controller.ts`) was fixed via a new
  `AdminService` + `UserRepository.count()`/`RoleRepository.count()`.
- **Verified end state:** `grep` confirms **no `this.prisma` / `@Inject(PRISMA)` in any
  service or controller** (only the allowed `health` `DATABASE_PINGER` + the repo DI
  factory use the singleton). Controllers are all thin.
- **Adversarial reviews** run per high-risk domain (Posts/Pages, Auth security + behaviour):
  **0 behaviour-preservation findings**; only minors, accepted/fixed.
- **Coverage gate** (V8): services + repositories **86.2% statements / 86.2% lines /
  86.2% branches / 80.9% functions** — `vitest.config.ts` now enforces an 80% threshold
  (the run fails below it). Critical paths covered.
- **Quality gates green:** `pnpm test` = **48 files / 268 tests**, `pnpm typecheck` clean,
  `pnpm lint` clean (whole repo), `pnpm vitest run --coverage` exits 0.
- A **completeness-critic** pass found no blockers; its two SHOULD-FIX items (enforce the
  coverage threshold; refresh this HANDOFF) are resolved here.

## PENDING (Task 2 + Task 4 are DONE — these are the remaining engagement tasks)
1. **Task 1 — feature parity** (`REFACTOR_PLAN.md` §7): per-locale content translation,
   per-content SEO meta, password reset + transactional email, menu builder, contact form,
   GA4/GTM, auto thumbnails, plugin admin UI, Redis cache, and the shared net-new
   (revision-restore UI, scheduled publishing, RSS, comment-notification email). These bring
   DB migrations (ship reversible) and will attach side-effects to the observer per §2.7.
2. **Task 3 — UI** (`REFACTOR_PLAN.md` §8): conform public site + admin to
   `../DESIGN_SYSTEM.md`; Lighthouse ≥95 mobile + WCAG AA, measured.
3. **Task 5 — README**: rewrite to match the other two stacks' READMEs (architecture now
   includes the repository layer — a short note was added; a fuller rewrite belongs with
   Task 1/3 when the feature set settles).
4. **E2E (Playwright)**: re-run `pnpm e2e` against a running stack to confirm the refactor
   is black-box-invariant (needs a DB + web/api up; not run in this unit-only pass).

### Carry-over notes
- Pre-existing biome debt in 13 unrelated files was format-only cleaned in the coverage
  commit so the lint gate is green; no behaviour touched.
- Two accepted minors (not regressions): `RevisionCreateData` permits both postId+pageId
  (callers never do); `recaptcha.service.ts` low coverage is pre-existing/out-of-scope.

**Conventions established (reuse for remaining domains):**
- Repo file exports `interface`, `X_REPOSITORY` Symbol, `PrismaXRepository`; trivial repos
  extend `PrismaCrudRepository` (super(prisma.<model>)) for `exists`/`hardDelete`.
- Module wiring: `provideRepository(TOKEN, PrismaImpl)` in the feature module's providers.
- Service tests use fakes typed `Record<keyof XRepository, Mock>` cast `as unknown as X`.
- Tests/services import model + repo types from `@cmstack-ts/db` (NOT `@prisma/client`).
- `$transaction` stays the array-batch form; repos never catch P2002/P2025.

## Decisions / rejected options
- **Operator chose a FULL repository layer** for all domains (over my
  hybrid/keep-as-is recommendation) for cross-stack parity; consciously overrides
  CLAUDE.md "no speculative abstraction" — for the repository layer only.
- **Repos return Prisma payload types** (not DDD entities): buys testability + query
  encapsulation, NOT store portability (accepted; no entity mappers).
- **Observer:** service emits where side effect is real; repo pure (operator choice).
- **`export * from '@prisma/client'`** in `packages/db` (was minimal `{Prisma,
  PrismaClient}`) so consumers get model types without depending on `@prisma/client`.

## Open questions
- None blocking. Matrix-gap flags: none found yet (recorded in plan §7).

## How to run
- Install: `pnpm install` (Node ≥22). Tests: `pnpm test` (single: `pnpm vitest run
  <path>`). Lint: `pnpm lint` / fix `pnpm format`. Types: `pnpm typecheck` (builds
  packages first). E2E: `pnpm e2e`.
- Per-domain loop: write repo contract test (mock Prisma) → impl → service test (fake
  repo) → refactor service → wire module → `pnpm test` + biome + typecheck → commit →
  adversarial skeptics.

### Full stack for LIVE verification (the recipe used for §7 #1–#3, copy verbatim)
The unit suite mocks Prisma and needs no DB; **live** checks (curl the API, SSR the web,
`pnpm e2e` against a real stack) need db + api + web up. Gotcha: `packages/db` does NOT
auto-load the root `.env`, so pass `DATABASE_URL` explicitly to every prisma command. The
docker compose DB is named **`typress`** (legacy creds `typress/typress/typress`).
```bash
cd cmstack-ts
docker compose up -d db                       # postgres on :5432 (named volume; persists)
export DATABASE_URL="postgresql://typress:typress@localhost:5432/typress?schema=public"
pnpm db:generate
pnpm --filter @cmstack-ts/db exec prisma migrate deploy   # apply migrations
pnpm db:seed                                  # idempotent demo seed (admin@cmstack-ts.local / admin12345)
# Build (Next inlines NEXT_PUBLIC_* at BUILD time, so export before `pnpm build`):
export NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
  AUTH_URL=http://localhost:3000 AUTH_SECRET=dev-only-change-me-32+chars-please \
  INTERNAL_API_SECRET=dev-only-change-me-internal-secret API_INTERNAL_URL=http://localhost:4000 \
  WEB_ORIGIN=http://localhost:3000 NODE_ENV=production
pnpm build
# Run API (needs DATABASE_URL + AUTH_SECRET + INTERNAL_API_SECRET + WEB_ORIGIN + UPLOAD_DIR exported):
UPLOAD_DIR=uploads node apps/api/dist/main.js &          # health: curl 127.0.0.1:4000/health/ready
pnpm --filter @cmstack-ts/web start &                    # next start on :3000 (reuses the exported env)
pnpm e2e                                                  # 11/11 (web-alone; live API checks are manual curl)
```
- **Password-reset live check:** with `SMTP_HOST` unset the mailer logs the reset link to
  the API stdout — grep it: `grep -oE "reset-password\?token=[a-f0-9]+" <api-log>`.
- **Reset the admin password** if a live test changed it: re-run request→confirm with
  `admin12345`, or it's a throwaway dev DB.

## Gotchas
- **`Write`-tool artifact:** files written via the Write tool get a stray `</content>`
  line appended — strip it (`perl -0pi -e 's/\n?<\/content>\s*$//' <file>`) and
  re-run `pnpm format` (also restores the final newline biome wants) before testing.
- Vitest resolves `@cmstack-ts/{db,config}` to `src` (no build needed for tests);
  `pnpm typecheck` DOES build packages to `dist` first.
- `packages/db` is CommonJS; `apps/api` CommonJS (Nest); `apps/web`/`apps/mcp` ESM.
- Reply to the operator in **Russian**; code/comments/docs in **English**.

---

## Continuation prompt (paste into a fresh window)
> You are continuing the `cmstack-ts` engagement (senior TS engineer, autonomous).
> Working dir `/Users/huseyn0w/Desktop/SWE/cmstack/cmstack-ts`, branch
> `refactor/repository-layer` (clean tree, all committed; **316 tests, typecheck + biome
> clean, coverage gate ≥80%**). **DONE:** Task 2 (repository-layer refactor) + Task 4
> (tests); the E2E baseline re-run (11/11, refactor confirmed black-box-invariant); and
> **Task 1 §7 items #1 (per-locale content translation), #2 (per-content SEO meta), #3
> (password reset + transactional email)** — all live-verified. **Read first:**
> `cmstack-ts/HANDOFF.md` (the Task-1 progress section + "Full stack for LIVE verification"
> recipe + Gotchas), `cmstack-ts/REFACTOR_PLAN.md` (§2.0 layering, §2.7 observer policy,
> §7 feature register with #1–#3 checked, §10 invariants), `cmstack-ts/CLAUDE.md`, and the
> read-only canon `../FEATURE_MATRIX.md` + `../DESIGN_SYSTEM.md` (do NOT edit the canon).
> The design+plan docs for finished items are in `docs/superpowers/{specs,plans}/`.
>
> **Resume with Task 1 §7 in strict order (operator directive) — next is #4 menu
> management** (admin drag-sortable builder; items reference posts/pages/categories/custom
> URLs; **per-locale**, reusing the #1 translation pattern; public menu rendering). After
> it: #5 contact form (reuses the #3 `MailService`), #6 GA4/GTM, #7 auto thumbnails, #8
> dashboard translation tab-strip UI (the admin editor for the #1 translation endpoints),
> #9 plugin admin UI, #10 Redis cache, then the shared net-new. Then Task 3 (UI §8) +
> Task 5 (full README rewrite).
>
> Per-feature loop (proven this session): brainstorm scope if unclear → spec+plan under
> `docs/superpowers/` → TDD by layer (config schema → prisma migration (additive/reversible)
> → repository (+contract test) → service (+fake-repo test) → thin controller → web) → wire
> through the EXISTING three-layer pattern (never `this.prisma` in a service) → observer
> (`HookRegistry`) only on a real side effect (§2.7) → run full gates (`pnpm test` /
> `typecheck` / `lint` / `pnpm vitest run --coverage`) → rebuild + `pnpm e2e` + **live curl/SSR
> verification** (use the HANDOFF stack recipe) → adversarial self-review (inline, do NOT
> spawn parallel agents — the operator dislikes the permission prompts) → refresh HANDOFF +
> tick the §7 box → commit.
>
> Operating rules (operator-set, see saved memories): **work fully autonomously** — only ask
> when truly critical; **NO `Co-Authored-By`/Claude trailer in commit messages**; reply to the
> operator in **Russian**, code/comments/docs in English. Show real command output — never claim
> green without the run. Conventions: repo = interface + `X_REPOSITORY` Symbol +
> `PrismaXRepository` (trivial ones extend `PrismaCrudRepository`); wire via
> `provideRepository(TOKEN, Impl)`; service test fakes typed `Record<keyof XRepo, Mock>`; import
> model+repo types from `@cmstack-ts/db` (never `@prisma/client`); repos never catch P2002/P2025;
> locales come from `@cmstack-ts/config` `LOCALES`/`DEFAULT_LOCALE`. **Gotcha:** if the Write tool
> appends a stray `</content>` line, strip it (`perl -0pi -e 's/\n?<\/content>\s*$//' <file>`) +
> `pnpm format`. The docker `db` container is likely already up (named DB `typress`); `packages/db`
> needs `DATABASE_URL` passed explicitly to prisma commands.