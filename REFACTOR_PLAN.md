# cmstack-ts — Refactor Plan

> **Scope of this document:** the architecture refactor (Task 2) plus the test
> re-cover (Task 4), with a sequenced register of the remaining feature-parity
> (Task 1) and UI (Task 3) work. It is the decision record the prompt asks for:
> each data-access site → chosen pattern → justification → rejected alternatives.
> Code, comments and identifiers are English; progress notes to the operator are
> in Russian per the engagement prompt.

**Branch:** `refactor/repository-layer`
**Green baseline pinned before any change:** `pnpm test` → **27 files, 134 tests passing** (2.2s, Prisma mocked, no DB needed).

---

## 0. Premise correction (read first)

The engagement prompt states: *"route handlers/controllers in `apps/api` contain
business logic and direct DB access … instead of going through a service layer."*

**That is not the actual state of this codebase.** Verified by a full read of
`apps/api/src`:

- Controllers are already **thin**: decorator + `ZodValidationPipe` + delegate to a
  service. No business logic, no DB calls in controllers.
- A **service layer already exists** (one service per concern) and holds the
  business logic.
- The stack is **Prisma + NestJS 10 + Next.js 15** (not Drizzle/raw SQL as the
  prompt hedged).

The **real** architectural gap versus the prompt's target (`handlers → services →
repositories`) is the **missing repository layer**: services call `this.prisma.*`
directly. Several cross-cutting patterns the prompt lists **already exist** and are
sound (see §3) — adding them again would be the "overkill" the prompt's own
guardrail forbids.

This plan therefore targets the one genuine gap (repository extraction) and audits
every other pattern as *present / adding / rejected*.

---

## 1. Decision record

**Operator decision (recorded):** when shown that controllers are already thin,
services hold logic, and only the repository layer is missing — and that Prisma is
itself a data-access abstraction — the operator chose **a full repository layer for
all domains, wired via NestJS DI**, and prioritised **architecture + tests first**
(before feature parity and UI).

**Conscious override of a local convention.** `CLAUDE.md` says *"Add abstractions
only where they remove real duplication — not speculatively."* A blanket repository
layer over Prisma is, for the trivial domains, exactly such a speculative
abstraction. The operator overrode this convention deliberately to reach
cross-stack architectural parity (Laravel uses explicit repositories; the canon
wants the three stacks to converge). This override is in force **only** for the
repository layer; the "no speculative abstraction" rule still governs everything
else in this plan.

**Rejected alternatives (and why):**

| Alternative | Why rejected |
|---|---|
| **Keep `service + Prisma`, extract only shared query helpers** (my recommendation) | Lower ceremony, Prisma already abstracts data access — but **rejected by the operator** in favour of full parity with the Laravel repository model. |
| **Repository only for complex domains (Posts/Pages/Comments/Media)** | Hybrid; leaves an inconsistent boundary across the API — **rejected** for the same parity reason. |
| **Map to domain entities (DDD) instead of returning Prisma payloads** | Adds a second type system + mappers for zero behavioural gain at this size; genuine over-engineering. **Rejected**; repositories return Prisma payload types, services keep the existing DTO mappers (§2.3). |

---

## 2. Repository architecture & conventions

### 2.1 Location & shape
- Interfaces + Prisma implementations live in **`packages/db/src/repositories/`**
  (the prompt: *"data access in `packages/db` behind interfaces"*). One file per
  aggregate: `post.repository.ts`, `page.repository.ts`, … each exporting:
  - an **interface** `XRepository` (the contract services depend on),
  - a **token** `X_REPOSITORY` (a `Symbol`, for Nest DI),
  - a Prisma implementation `PrismaXRepository implements XRepository`.
- `packages/db/src/index.ts` re-exports every interface, token and implementation
  (alongside the existing `prisma`, `Prisma`, `PrismaClient`).
- A new `apps/api/src/persistence/persistence.module.ts` (`@Global`) provides every
  repository token bound to its Prisma implementation, constructed from the existing
  `prisma` singleton. Services swap `@Inject(PRISMA)` → `@Inject(X_REPOSITORY)`.

### 2.2 DI tokens (so neighbouring tasks agree on names)
`POST_REPOSITORY`, `PAGE_REPOSITORY`, `CATEGORY_REPOSITORY`, `TAG_REPOSITORY`,
`POST_LIKE_REPOSITORY`, `REVISION_REPOSITORY`, `SEARCH_REPOSITORY`,
`COMMENT_REPOSITORY`, `MEDIA_REPOSITORY`, `USER_REPOSITORY`, `ACCOUNT_REPOSITORY`,
`ROLE_REPOSITORY`, `SITE_PROFILE_REPOSITORY`, `SERVICE_REPOSITORY`,
`FAQ_REPOSITORY`, `SETTING_REPOSITORY`.

### 2.3 Return-type & mapping policy
- Repositories return **Prisma payload types** (e.g. `PostWithRelations =
  Prisma.PostGetPayload<{ include: typeof postInclude }>`). The `include`/`select`
  constants (`postInclude`, `pageInclude`, the two `userInclude` shapes, …) **move
  into the repository file** that owns them and are exported for the service's
  return-type annotations.
- Repositories own all `where`/`include`/`select`/`orderBy`/`connect` construction
  and all `$transaction` batching. **No Prisma query shape remains in any service.**
- Services keep their existing **DTO mappers** (`toDetail`, `toSummary`, `toView`,
  `toAdminUser`, …) that turn payloads into `@cmstack-ts/config` response types.
  Config DTOs stay the API↔web contract; `packages/db` never imports `@nestjs/*`.

### 2.4 Error-handling boundary
- Repositories are **framework-free**: they never import or throw `@nestjs/common`
  HTTP exceptions. They return `null`/`boolean`/empty for "not found", and let
  genuine Prisma errors (`P2002`, `P2025`) propagate.
- **Services keep ownership of HTTP semantics**: the existing `NotFoundException` /
  `ConflictException` / `BadRequestException` / `ForbiddenException` mapping and the
  P2002→409 / P2025→404 translation stay in the service layer. This preserves the
  exact current behaviour (the contract the characterization tests pin).
- Race-resilient flows (likes ignoring concurrent `P2002`/`P2025`) keep that logic
  in the service; the repository exposes the primitive operations it calls.

### 2.5 Slug uniqueness
Each of Posts/Pages/Categories/Tags has a private `uniqueSlug()` loop that today
queries inside the service. The **query** (`findUnique({ where: { slug } })` →
boolean) moves to the repo as `slugExists(slug)`; the **loop/`-2`,`-3` suffix
strategy** stays in the service (it is business logic, not data access).

---

## 3. Pattern audit — present / adding / rejected

Per the prompt: *"Apply patterns only where they genuinely reduce complexity … no
overkill; justify each."*

| Pattern (prompt) | Verdict | Justification |
|---|---|---|
| **Service layer** | ✅ already present | One service per concern; thin controllers. No change of principle — services get slimmer once data access leaves them. |
| **Repository** | ➕ **adding** (this plan) | The one real gap. Encapsulates Prisma behind per-aggregate interfaces; enables service unit tests with a fake repo instead of a mocked `PrismaClient`. |
| **Dependency injection** | ✅ already present | Nest DI throughout (`@Inject(PRISMA)`, `STORAGE`, `DATABASE_PINGER`). Repositories slot into the same mechanism. |
| **Observer / event bus** | ✅ already present | `HookRegistry` (filters + fault-isolated actions). `post.published` already emitted. **No new bus** — would duplicate it. Future side-effects (comment-notification email, search reindex) attach here. |
| **Middleware** | ✅ already present | `JwtAuthGuard`/`PoliciesGuard` (auth+CASL), `ThrottlerGuard` (rate limit), `ZodValidationPipe` (validation). No new middleware needed for the refactor. |
| **Adapter / Bridge** | ✅ already present (Storage) | `StorageDriver` + `STORAGE` token; local today, S3 a one-provider swap. Correct and minimal — keep. |
| **Factory** | ❌ rejected | No branching construction complexity that a factory would reduce. Adding one is ceremony. |
| **Strategy** | ❌ rejected (now) | Only candidate is search backend (FTS vs `icontains` fallback). Current code is Postgres-FTS-only; a strategy is **deferred** to whenever the MySQL fallback is actually built (matrix §4 "graceful fallback"), tracked in §6. |

**Net new structural change from Task 2 = the repository layer only.** Everything
else is audited as already-satisfied or deliberately rejected.

---

## 4. Per-domain mapping (data-access site → repository contract)

For each service: the repository interface it will depend on, and which Prisma
operations move. Business logic that **stays in the service** is listed so the
boundary is unambiguous. Method signatures here are the contract the execution
tasks implement verbatim.

> Notation: payload aliases (`PostWithRelations`, etc.) are the existing service
> `include` types, relocated to the repo file and exported.

### 4.1 Content — `PostsService` → `PostRepository` (`POST_REPOSITORY`)
```
create(data: PostCreateData): Promise<PostWithRelations>
findById(id): Promise<PostWithRelations | null>
findActiveById(id): Promise<PostWithRelations | null>        // deletedAt: null
findPublicBySlug(slug): Promise<PostWithRelations | null>    // PUBLISHED, deletedAt: null
listAndCount(filter: PostListFilter): Promise<{ items: PostWithRelations[]; total: number }>  // $transaction
publicByAuthor(authorId): Promise<PostWithRelations[]>
update(id, data: PostUpdateData): Promise<PostWithRelations>
setDeletedAt(id, when: Date | null): Promise<void>
restore(id): Promise<PostWithRelations>
hardDelete(id): Promise<void>
exists(id): Promise<boolean>
slugExists(slug): Promise<boolean>
```
- `PostCreateData`/`PostUpdateData` carry `categoryIds?`/`tagIds?`; the repo builds
  `categories/tags: { connect }`. `PostListFilter` carries
  `status?/categorySlug?/tagSlug?/includeTrashed?/publicOnly/page/perPage` and the
  repo builds the `where` + paging + the `[{publishedAt:desc},{createdAt:desc}]`
  order.
- **Stays in service:** sanitize, `uniqueSlug` loop, `publishedAt` stamping,
  revision snapshot building, `hooks.emit('post.published')`,
  `hooks.applyFilters('public.post.render')`, P2002/P2025→HTTP mapping, DTO mappers.
- Revision writes/reads go through `RevisionRepository` (§4.6).

### 4.2 Content — `PagesService` → `PageRepository` (`PAGE_REPOSITORY`)
```
create(data: PageCreateData): Promise<PageWithAuthor>
findById(id): Promise<PageWithAuthor | null>
findActiveById(id): Promise<PageWithAuthor | null>
findPublicBySlug(slug): Promise<PageWithAuthor | null>
list(opts: { includeTrashed?: boolean }): Promise<PageWithAuthor[]>
update(id, data: PageUpdateData): Promise<PageWithAuthor>
setDeletedAt(id, when: Date | null): Promise<void>
restore(id): Promise<PageWithAuthor>
hardDelete(id): Promise<void>
exists(id): Promise<boolean>
slugExists(slug): Promise<boolean>
```
- **Stays in service:** sanitize, `uniqueSlug`, revision snapshot, DTO mapping.

### 4.3 Content — `CategoriesService` → `CategoryRepository` (`CATEGORY_REPOSITORY`)
```
create(data: { name; slug; description?; parentId? }): Promise<Category>
findById(id): Promise<Category | null>
list(): Promise<Category[]>                      // orderBy name asc
update(id, data: Partial<...>): Promise<Category>
exists(id): Promise<boolean>
hardDelete(id): Promise<void>
slugExists(slug): Promise<boolean>
```
- **Stays in service:** slug loop, self-parent prevention, parent-exists validation,
  P2025 mapping.

### 4.4 Content — `TagsService` → `TagRepository` (`TAG_REPOSITORY`)
```
create(data: { name; slug }): Promise<Tag>
findById(id): Promise<Tag | null>
list(): Promise<Tag[]>
update(id, data): Promise<Tag>
exists(id): Promise<boolean>
hardDelete(id): Promise<void>
slugExists(slug): Promise<boolean>
```

### 4.5 Content — `LikesService` → `PostLikeRepository` (`POST_LIKE_REPOSITORY`)
```
findPublishedPostIdBySlug(slug): Promise<string | null>
findLike(postId, userId): Promise<{ id: string } | null>
createLike(postId, userId): Promise<void>
deleteLike(postId, userId): Promise<void>
countLikes(postId): Promise<number>
```
- **Stays in service:** race-resilient toggle (swallow concurrent P2002/P2025 and
  recompute), state assembly. (`findPublishedPostIdBySlug` is shared with Comments —
  exposed on both repos against their own model to avoid cross-aggregate coupling.)

### 4.6 Content — Revisions → `RevisionRepository` (`REVISION_REPOSITORY`)
```
create(data: { postId?: string; pageId?: string; authorId: string; snapshot: Prisma.JsonValue }): Promise<void>
listForPost(postId): Promise<RevisionRow[]>     // orderBy createdAt desc
listForPage(pageId): Promise<RevisionRow[]>
```

### 4.7 Content — `SearchService` → `SearchRepository` (`SEARCH_REPOSITORY`)
```
searchPosts(tsQuery: string, limit: number, offset: number): Promise<SearchRow[]>
countPosts(tsQuery: string): Promise<number>
```
- The two `$queryRaw` FTS statements (`to_tsvector`/`websearch_to_tsquery`/`ts_rank`,
  always **bound** params) move verbatim into the repo. **Stays in service:** query
  normalisation, pagination math, response shaping. (Strategy for a MySQL
  `icontains` fallback is deferred — §3, §6.)

### 4.8 Comments — `CommentsService` → `CommentRepository` (`COMMENT_REPOSITORY`)
```
findPublishedPostIdBySlug(slug): Promise<string | null>
findApprovedById(id, postId): Promise<{ id: string } | null>     // parent validation
create(data: CommentCreateData): Promise<void>
listApprovedForPost(postId): Promise<FlatCommentRow[]>           // select public fields only
listAndCount(filter: AdminCommentFilter): Promise<{ items: AdminCommentRow[]; total: number }>  // $transaction, include post {slug,title}
exists(id): Promise<boolean>
updateStatus(id, status): Promise<AdminCommentRow>
hardDelete(id): Promise<void>
```
- **Stays in service:** reCAPTCHA verify, `buildCommentThread`, never-expose-email
  rule (enforced by the repo's `select`), status validation.

### 4.9 Media — `MediaService` → `MediaRepository` (`MEDIA_REPOSITORY`)
```
create(data: MediaCreateData): Promise<Media>
findById(id): Promise<Media | null>
listAndCount(query): Promise<{ items: Media[]; total: number }>  // $transaction
update(id, data: { alt?; title?; caption? }): Promise<Media>
exists(id): Promise<boolean>
findFilename(id): Promise<string | null>
hardDelete(id): Promise<void>
```
- **Stays in service:** byte-level validation, dimension measurement,
  `extensionForMime`, `StorageDriver` save/delete, **rollback on failed DB write**
  (service orchestrates storage+repo).

### 4.10 Auth — `AccountsService` → `UserRepository` + `AccountRepository` + `RoleRepository`
```
// UserRepository (USER_REPOSITORY) — userInclude = { role: { include: { permissions: true } } }
findByEmailWithRole(email): Promise<UserWithRole | null>
findByIdWithRole(id): Promise<UserWithRole | null>
createWithRole(data: UserCreateData): Promise<UserWithRole>
updateProfile(id, data): Promise<{ id; name; image; bio }>
// AccountRepository (ACCOUNT_REPOSITORY)
findByProvider(provider, providerAccountId): Promise<AccountWithUserRole | null>
linkToUser(userId, data): Promise<void>
createUserWithAccount(data): Promise<UserWithRole>
// RoleRepository (ROLE_REPOSITORY)
findByName(name): Promise<{ id: string } | null>
```
- **Stays in service:** Argon2id hashing, decoy-hash timing defence, JWT issuance,
  permission flattening, `DEFAULT_ROLE` policy.
- **Note:** `AccountsService` and `UsersService` use **different** `userInclude`
  shapes (permissions vs `{id,name}`). Keep them as **two distinct payload aliases**
  on `UserRepository` (`UserWithRole` vs `UserWithRoleSummary`) — do **not** collapse
  them; that would change query cost and the returned shape (behaviour change).

### 4.11 Auth — `UsersService` → `UserRepository` (admin methods) + `RoleRepository`
```
listAndCount(query): Promise<{ items: UserWithRoleSummary[]; total: number }>  // $transaction
findByIdSummary(id): Promise<UserWithRoleSummary | null>
existsById(id): Promise<boolean>
update(id, data): Promise<UserWithRoleSummary>
hardDelete(id): Promise<void>
// RoleRepository
list(): Promise<RoleSummaryRow[]>
```
- **Stays in service:** search-term building, self-role-change & self-delete
  prevention, role-exists validation.

### 4.12 Authors — `AuthorsService` → `UserRepository`
```
findPublicProfile(id): Promise<{ id; name; image; bio } | null>
```
- **Stays in service:** delegation to `PostsService.publicByAuthor`.

### 4.13 SEO/GEO — `SeoService` → `SiteProfileRepository` + `ServiceRepository` + `FaqRepository`
```
// SITE_PROFILE_REPOSITORY
get(): Promise<SiteProfile | null>                 // id: 'default'
upsert(data): Promise<SiteProfile>
// SERVICE_REPOSITORY
list(): Promise<Service[]>                          // orderBy [order asc, createdAt asc]
create(data), update(id,data), exists(id), hardDelete(id)
// FAQ_REPOSITORY
list(): Promise<FaqItem[]>
create(data), update(id,data), exists(id), hardDelete(id)
```

### 4.14 Settings — `SettingsService` → `SettingRepository` (`SETTING_REPOSITORY`)
```
get(key): Promise<Setting | null>
upsert(key, value): Promise<Setting>
```
- **Stays in service:** default-theme fallback.

### 4.15 Health — `HealthService`
- Already depends on the minimal `DATABASE_PINGER` interface, not `PrismaClient`.
  **No repository** — leave as-is (it is a liveness probe, not data access). Noted so
  the audit is complete.

### Services with **no** Prisma (unchanged)
`PasswordService`, `HtmlSanitizerService`, `RecaptchaService`, `HookRegistry`,
`LocalStorageService`.

---

## 5. Test strategy (Task 4)

1. **Characterization first (TDD discipline for refactors).** Before moving a
   service's data access, add service-level tests that pin **current** behaviour
   using a fake/mocked collaborator, then keep them green through the move. Existing
   specs (`users`, `accounts`, `media-ext`, `slug`, `thread`, sanitizer, recaptcha,
   health, hook-registry, ability, guard) stay green unchanged.
2. **Repository contract tests.** Each Prisma repository gets a unit test with a
   mocked `PrismaClient` asserting it issues the right operation with the right
   `where/include/order` (the shape that previously lived in the service).
3. **Service tests against a fake repository.** After the move, each service is
   tested with an in-memory fake implementing the repository interface — this is the
   payoff of the layer (no Prisma mock gymnastics).
4. **Coverage:** enable V8 coverage in `vitest.config.ts`; target **≥80% lines on
   services + repositories**, **100% on critical paths** (auth login/register/oauth,
   content create/update/publish/soft-delete/restore, media upload, comment
   submit/moderate, search). Report real numbers; never assert passing without the run.
5. **E2E (Playwright)** unchanged by the refactor (black-box); re-run to prove no
   regression. Add regression tests for every issue the adversarial review surfaces.

---

## 6. Execution sequence

Each domain is an independently testable, committable unit. After each domain:
`pnpm test` green, `pnpm lint`, `pnpm typecheck`, then **2–3 independent adversarial
Opus skeptics** (lenses: behaviour-preservation / correctness / security /
performance) before moving on. Order chosen low-risk → high-risk:

1. **Scaffolding** — `packages/db` repository dir, tokens, `PersistenceModule`
   (`@Global`), barrel exports. No behaviour change.
2. **Settings** (smallest) → **SEO/GEO** → **Tags** → **Categories** — simple CRUD,
   prove the pattern end-to-end.
3. **Media** (storage orchestration + rollback) → **Likes** → **Comments**.
4. **Revisions** + **Search** (raw SQL) .
5. **Pages** → **Posts** (most relations, hooks, revisions — highest risk, last).
6. **Auth** (Users/Accounts/Roles — security-critical; full adversarial pass).
7. **Coverage gate** + completeness-critic pass.

Then (separate, later phases — architecture-first per operator decision):
**Task 1 feature parity** and **Task 3 UI** per §7.

---

## 7. Feature-parity register (Task 1) — PENDING, sequenced after architecture

From `../FEATURE_MATRIX.md` ("cmstack-ts needs"), nothing to be silently dropped:

- [ ] Per-locale **content** translation (Prisma translation tables) — biggest gap.
- [ ] Per-content **SEO meta** (metaTitle/metaDescription/canonical/noindex).
- [ ] **Password reset** + transactional **email** wiring.
- [ ] **Menu management** builder + public rendering.
- [ ] **Contact form** + email delivery (reCAPTCHA-protected).
- [ ] **GA4/GTM** injection + site-verification tags (public pages only).
- [ ] **Auto thumbnails / image processing** (decompression-bomb guard).
- [ ] **Dashboard translation editing UI** (per-locale tab strip) — after content i18n.
- [ ] **Plugin admin UI** + runtime enable/disable + render-region hooks.
- [ ] **Caching layer** (Redis + page/fragment cache, invalidate on publish).
- [ ] Shared net-new: **revision-restore UI**, **scheduled publishing**, **RSS/Atom
      feeds**, **comment-notification email** (attaches to `HookRegistry`),
      **coverage reporting** (folded into Task 4).

### Matrix gaps / errors to flag to the operator
- **None found yet.** (The matrix's "ts" claims match the code as inventoried.) Any
  discrepancy discovered during execution will be recorded here and flagged — the
  shared `../FEATURE_MATRIX.md` will **not** be edited (parallel sessions depend on it).

---

## 8. Task 3 (UI) — deferred, summary only
Conform public site + admin to `../DESIGN_SYSTEM.md` (tokens, Newsreader/Inter/Geist
Mono, components, motion, a11y), hit Lighthouse ≥95 mobile (perf/SEO/a11y/best-
practices) and WCAG 2.1 AA — measured, not assumed. Detailed plan to be written when
this phase starts.

---

## 9. Risks & rollback
- **Behaviour drift** is the only real risk of a pure refactor → mitigated by the
  pinned 134-test baseline, characterization tests, and the adversarial pass per
  domain. Repositories are framework-free and return the same payloads, so DTO
  output is byte-identical.
- **Two `userInclude` shapes** must stay distinct (§4.10) — collapsing them is a
  behaviour change.
- **Rollback unit = one domain = one commit**; revert is a single `git revert`.
- No DB migrations in Task 2 (repository extraction is code-only). Migrations arrive
  with feature parity (§7) and ship reversible.
</content>
</invoke>
