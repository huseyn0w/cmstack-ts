# cmstack-ts — Refactor Plan

> **Scope of this document:** the architecture refactor (Task 2) plus the test
> re-cover (Task 4), with a sequenced register of the remaining feature-parity
> (Task 1) and UI (Task 3) work. It is the decision record the prompt asks for:
> each data-access site → chosen pattern → justification → rejected alternatives.
> Code, comments and identifiers are English; progress notes to the operator are
> in Russian per the engagement prompt.

**Branch:** `refactor/repository-layer`
**Green baseline pinned before any change:** `pnpm test` → **27 files, 134 tests passing** (2.2s, Prisma mocked, no DB needed).

**Revision:** integrates two independent adversarial reviews of the first draft
(over-engineering lens + behaviour-preservation lens). Their must-fixes are folded
into §2, §4 and the new §10 (behaviour-preservation invariants).

---

## 0. Premise correction (read first)

The engagement prompt states: *"route handlers/controllers in `apps/api` contain
business logic and direct DB access … instead of going through a service layer"*,
and was updated to **forbid business logic in controllers — it must live in the
service layer**.

**Almost no "fat controller" state — but one real case exists.** Verified by a full
read of `apps/api/src` (19 controllers):

- 18 of 19 controllers are already **thin**: decorator + `ZodValidationPipe` +
  delegate to a service. No business logic, no DB calls.
- **Exception (the one genuine violation):** `admin/admin.controller.ts` injects
  `PrismaClient` and runs `Promise.all([user.count(), role.count()])` directly in the
  `overview()` handler — business logic **and** data access in the controller. This is
  exactly what the updated prompt forbids. It is fixed in this plan (§4.10b): a new
  `AdminService` holds the logic and reads via `UserRepository.count()` /
  `RoleRepository.count()`; the controller becomes a thin delegate. This is the
  clearest demonstration of the three-layer rule (§2.0).
- The refactor adds an explicit layering invariant + a per-domain verification step
  (§2.0, §6) so no controller regresses.
- A **service layer already exists** (one service per concern) and holds the logic.
- The stack is **Prisma + NestJS 10 + Next.js 15** (not Drizzle/raw SQL).

The **real** gap versus the target (`controllers → services → repositories`) is the
**missing repository layer**: services call `this.prisma.*` directly. Several
cross-cutting patterns the prompt lists **already exist** and are sound (§3) —
re-adding them would be the "overkill" the prompt's own guardrail forbids.

---

## 1. Decision record

**Operator decision (recorded):** shown that controllers are already thin, services
hold logic, and only the repository layer is missing — and that Prisma is itself a
data-access abstraction — the operator chose **a full repository layer for all
domains, wired via NestJS DI**, and prioritised **architecture + tests first**.

**Conscious override of a local convention.** `CLAUDE.md` says *"Add abstractions
only where they remove real duplication — not speculatively."* A blanket repository
layer over Prisma is, for trivial domains, such a speculative abstraction. The
operator overrode this deliberately for cross-stack parity (Laravel uses explicit
repositories; the canon wants convergence). The override is in force **only** for the
repository layer; "no speculative abstraction" still governs everything else.

**What this layer buys — and what it deliberately does NOT (honesty note):** it buys
**testability** (services unit-tested against a fake repo, no Prisma-mock gymnastics)
and **query-shape encapsulation** (no `where/include/orderBy/$transaction` in any
service). It does **not** buy **store portability**: repositories return Prisma
payload *types* (§2.3), so services stay coupled to Prisma's generated types. That is
an accepted trade (entity mapping would be pure ceremony at this size). No future
reader should "finish the job" with domain-entity mappers.

**Rejected alternatives:**

| Alternative | Why rejected |
|---|---|
| Keep `service + Prisma`, extract only shared query helpers (my recommendation) | Lower ceremony, Prisma already abstracts data access — **rejected by the operator** for full parity with the Laravel repository model. |
| Repository only for complex domains (Posts/Pages/Comments/Media) | Hybrid; inconsistent boundary across the API — **rejected** for the same parity reason. |
| Map to domain entities (DDD) instead of Prisma payloads | A second type system + mappers for zero behavioural gain at this size; genuine over-engineering. **Rejected**; repos return Prisma payloads, services keep the existing DTO mappers (§2.3). |

---

## 2. Repository architecture & conventions

### 2.0 Layering invariant (enforced, per the updated prompt)
1. **Controller** — thin: parse/validate (`ZodValidationPipe`), call one service
   method, map to the HTTP response. **No business logic, no data access.**
2. **Service** — owns all business logic: validation beyond shape, slug strategy,
   sanitisation, hashing, `publishedAt`/hook decisions, error→HTTP mapping,
   orchestration, DTO mapping, **and emitting domain events through the observer
   (`HookRegistry`) where a write has a genuine side effect (§2.7)**. Reads/writes
   data only through repositories. **No Prisma query shapes.**
3. **Repository** (`packages/db`) — owns all data access: `where/include/select/
   orderBy/$transaction/connect/set/upsert/$queryRaw`. **Framework-free** (no
   `@nestjs/*`), returns Prisma payloads or `null`/`boolean`. Never throws HTTP
   exceptions; never catches/translates Prisma error codes (§2.4).

Each domain's commit includes a check that its controller carries no logic (it
already doesn't) and its service carries no Prisma shape.

### 2.1 Location & wiring
- Interfaces + Prisma implementations in **`packages/db/src/repositories/`**, one
  file per aggregate, each exporting: the **interface** `XRepository`, the **token**
  `X_REPOSITORY` (`Symbol`), the implementation `PrismaXRepository`, and any payload
  aliases / `include` constants it owns.
- `packages/db/src/index.ts` re-exports all of the above (with `prisma`, `Prisma`,
  `PrismaClient`).
- **No `@Global` god-module** (adversarial finding — it ambient-injects every repo
  everywhere and erodes "modules = bounded concerns"). Instead **each feature module
  provides its own repository bindings** (`{ provide: X_REPOSITORY, useClass:
  PrismaXRepository }`) in its `providers`. The Prisma singleton is injected into the
  impls via the existing `PRISMA` token. Cross-domain reads (Likes/Comments needing a
  Post lookup) import the owning module or its provider explicitly (§4.5/§4.8).
- **Tokens are uniform** (interface + `Symbol`) across all aggregates: every service
  is unit-tested against a **fake repository** (§5.3), so every interface is genuinely
  faked — the token earns its keep everywhere, and uniformity keeps the parity the
  operator asked for.

### 2.2 DI tokens
`POST_REPOSITORY`, `PAGE_REPOSITORY`, `CATEGORY_REPOSITORY`, `TAG_REPOSITORY`,
`POST_LIKE_REPOSITORY`, `REVISION_REPOSITORY`, `SEARCH_REPOSITORY`,
`COMMENT_REPOSITORY`, `MEDIA_REPOSITORY`, `USER_REPOSITORY`, `ACCOUNT_REPOSITORY`,
`ROLE_REPOSITORY`, `SITE_PROFILE_REPOSITORY`, `SERVICE_REPOSITORY`,
`FAQ_REPOSITORY`, `SETTING_REPOSITORY`.

### 2.3 Return-type & mapping policy
- Repositories return **Prisma payload types** (e.g. `PostWithRelations =
  Prisma.PostGetPayload<{ include: typeof postInclude }>`). The `include`/`select`
  constants move into the owning repo file and are exported for service annotations.
- Repositories own all query construction and `$transaction` batching.
- Services keep their existing **DTO mappers** (`toDetail`/`toSummary`/`toView`/…)
  producing `@cmstack-ts/config` response types. `packages/db` never imports
  `@nestjs/*`.

### 2.4 Error-handling boundary (hard rule)
- Repositories are **framework-free**: never import/throw `@nestjs/common` exceptions.
  "Not found" → return `null`/`false`/empty. **Genuine Prisma errors (`P2002`,
  `P2025`, etc.) propagate UNWRAPPED** — repositories must **never** `try/catch` or
  translate them.
- This rule is **load-bearing**, not cosmetic:
  - Services map `P2002→409` / `P2025→404` in their own `try/catch` (Posts, Pages,
    Categories, Media). If a repo swallowed the error, the mapping would never fire.
  - **Likes race-resilience** depends on `PrismaClientKnownRequestError` (`P2002`/
    `P2025`) reaching the *service's* `instanceof` check (`likes.service.ts:35`); a
    repo catch turns a benign concurrent toggle into a 500.
- HTTP semantics (`NotFoundException`/`ConflictException`/`BadRequestException`/
  `ForbiddenException`) stay entirely in services.

### 2.5 Slug uniqueness
The existence **query** moves to the repo as `slugExists(slug): Promise<boolean>`;
the `-2/-3` suffix **loop** (policy) stays in the service. Correct cut confirmed by
both reviews.

### 2.6 Shared CRUD base (de-ceremony, adversarial finding #1)
~40 of the proposed methods are 1:1 forwards (`exists`, `hardDelete`, `setDeletedAt`,
plain `findById`, `slugExists`). To keep one-repo-per-aggregate (parity) without
hand-writing + tautologically testing 40 forwards, the Prisma impls extend a small
generic base:
```ts
abstract class PrismaCrudRepository<Delegate extends {
  findUnique: Function; delete: Function; count: Function; update: Function;
}> {
  protected constructor(protected readonly model: Delegate) {}
  exists(id: string): Promise<boolean>;            // count({where:{id}}) > 0
  hardDelete(id: string): Promise<void>;           // delete({where:{id}})
  protected setField<T>(id, data): Promise<void>;  // update({where:{id},data})
}
```
- The **interface** still declares every method it exposes (the contract a fake
  implements) — uniform per aggregate. Only the **trivial impls** are inherited.
- Methods with real query shape (`listAndCount`, `findPublicBySlug`, the relation
  builders, `$queryRaw`) are written explicitly and get real contract tests; the
  inherited forwards do **not** get tautological "assert delete calls delete" tests.

### 2.7 Observer/event policy — `service → repository → observer` (operator decision)
The full data-flow is: **controller → service → repository** for data, and the
**service emits a domain event through the observer** (`HookRegistry`, already in the
codebase) **only where a write has a genuine side effect** (notifications, cache
invalidation, search reindex, audit). Operator-chosen (over "emit on every write" and
"repository emits"): keep the **repository pure/framework-free** (data only) and let
the **service** own event emission — services already orchestrate, and `packages/db`
stays decoupled and testable.

Rules:
- Events are emitted **after** the repository write succeeds, inside the service's
  success path; `emit` is fault-isolated (a throwing listener can't fail the write).
- **No speculative events.** An event is added only when a real subscriber exists or
  is required by a matrix feature being built — not "just in case" (that would be the
  dead-code/ceremony the guardrail forbids). New events extend the typed `ActionMap`/
  `FilterMap` catalogue (`plugins/hooks.ts`); no `any`.
- The repository never imports `HookRegistry`/`@nestjs/*` (keeps §2.4 intact).

**Per-domain event map (genuine side effects only):**

| Domain / write | Event (action) | Status | Consumer |
|---|---|---|---|
| Posts publish (`create`/`update` → PUBLISHED) | `post.published` | ✅ exists | reading-time sample plugin; future search reindex / cache invalidation |
| Public post read | `public.post.render` (filter) | ✅ exists | plugins transform output |
| Comment submit | `comment.created` | ➕ when **comment-notification email** (matrix §18) is built | email notifier |
| Content publish/update/delete; theme change | `*.changed` (cache invalidation) | ➕ when the **caching layer** (matrix §17) is built | cache invalidator |
| Settings theme change | `settings.theme.changed` | ⏸ deferred | none yet (no API-side cache today; arrives with the caching layer) |

Domains with **no genuine side effect** today (Settings, SEO/GEO CRUD, Tags,
Categories, Media metadata, Likes count) **do not emit** events now — adding them
would be speculative. The hook points are recorded above so they attach cleanly when
the consuming feature (caching, notifications, reindex) is built in Task 1.

---

## 3. Pattern audit — present / adding / rejected

| Pattern (prompt) | Verdict | Justification |
|---|---|---|
| **Service layer** | ✅ already present | Thin controllers; one service per concern. Slims further once data access leaves. |
| **Repository** | ➕ **adding** | The one real gap. Per-aggregate interfaces over Prisma; unlocks fake-repo service tests. |
| **Dependency injection** | ✅ already present | Nest DI throughout. Repos slot in via per-module providers. |
| **Observer / event bus** | ✅ already present | `HookRegistry` (filters + fault-isolated actions); `post.published` emitted. **No new bus.** Future side-effects (comment-notification email, search reindex, cache invalidation) attach here. |
| **Middleware** | ✅ already present | `JwtAuthGuard`/`PoliciesGuard`, `ThrottlerGuard`, `ZodValidationPipe`. None new. |
| **Adapter / Bridge** | ✅ already present | `StorageDriver` + `STORAGE` token; S3 = one-provider swap. Keep. |
| **Factory** | ❌ rejected | No branching construction a factory would simplify. |
| **Strategy** | ❌ deferred (not built) | Only candidate = search FTS vs `icontains` fallback. Built only when the MySQL fallback is (matrix §4). **Do not** add a premature `searchStrategy` seam to `SearchRepository`. |

**Net new structure from Task 2 = the repository layer only.**

---

## 4. Per-domain mapping (data-access site → repository contract)

Signatures are the contract the execution tasks implement verbatim. Behaviour-
preservation invariants for the tricky ones are in §10 (cross-referenced).

### 4.1 Content — `PostsService` → `PostRepository` (`POST_REPOSITORY`)
```
create(data: PostCreateData): Promise<PostWithRelations>       // categories/tags: { connect }
findById(id): Promise<PostWithRelations | null>
findActiveById(id): Promise<PostWithRelations | null>         // deletedAt: null
findPublicBySlug(slug): Promise<PostWithRelations | null>     // PUBLISHED, deletedAt: null
findPublishedIdBySlug(slug): Promise<string | null>          // shared read, OWNS Post (see §4.5/§4.8)
listAndCount(filter: PostListFilter): Promise<{ items: PostWithRelations[]; total: number }>  // $transaction ARRAY form
publicByAuthor(authorId): Promise<PostWithRelations[]>
update(id, data: PostUpdateData): Promise<PostWithRelations>   // categories/tags: { set } — NOT connect (§10.1)
setDeletedAt(id, when: Date | null): Promise<void>
restore(id): Promise<PostWithRelations>                       // setDeletedAt(null) then return findById include
hardDelete(id): Promise<void>
exists(id): Promise<boolean>
slugExists(slug): Promise<boolean>
```
- `PostCreateData` builds `{ connect }`; `PostUpdateData` builds `{ set }` (replace
  semantics) — **two distinct builders** (§10.1). `PostListFilter` carries
  `status?/categorySlug?/tagSlug?/includeTrashed?/publicOnly/page/perPage`; repo builds
  `where` + paging + order `[{publishedAt:desc},{createdAt:desc}]`.
- **Stays in service:** sanitize; `uniqueSlug` loop; `publishedAt` stamp + `becamePublished`
  decided from the pre-read `existing` *before* `repo.update` (§10.9); `hooks.emit('post.published')`
  inside the success `try` after the write (§10.9); `hooks.applyFilters('public.post.render')`;
  P2002/P2025→HTTP; DTO mappers. Revisions via `RevisionRepository` (§4.6), **separate await, no
  transaction** with the update (§10.9).

### 4.2 Content — `PagesService` → `PageRepository` (`PAGE_REPOSITORY`)
```
create(data: PageCreateData): Promise<PageWithAuthor>
findById(id): Promise<PageWithAuthor | null>
findActiveById(id): Promise<PageWithAuthor | null>
findPublicBySlug(slug): Promise<PageWithAuthor | null>
list(opts: { includeTrashed?: boolean }): Promise<PageWithAuthor[]>     // orderBy updatedAt desc
update(id, data: PageUpdateData): Promise<PageWithAuthor>
setDeletedAt(id, when: Date | null): Promise<void>
restore(id): Promise<PageWithAuthor>
hardDelete(id): Promise<void>
exists(id): Promise<boolean>
slugExists(slug): Promise<boolean>
```
- **Stays in service:** sanitize; `uniqueSlug`; revision snapshot (separate await, no
  transaction, §10.9); DTO mapping.

### 4.3 Content — `CategoriesService` → `CategoryRepository` (`CATEGORY_REPOSITORY`)
```
create(data: { name; slug; description?; parentId? }): Promise<Category>
findById(id): Promise<Category | null>
list(): Promise<Category[]>                                   // orderBy name asc
update(id, data: CategoryUncheckedUpdateInput): Promise<Category>   // scalar parentId, see §10.8
exists(id): Promise<boolean>
hardDelete(id): Promise<void>
slugExists(slug): Promise<boolean>
```
- Repo `update` takes a **`Prisma.CategoryUncheckedUpdateInput`** with **scalar
  `parentId`** (not `parent: { connect }`) — preserves the `'parentId' in input`
  (key-present-vs-null) semantics and the P2025→`mapError` path (§10.8). **Stays in
  service:** slug loop, self-parent prevention, parent-exists check, the
  `'parentId' in input` decision, P2025 mapping.

### 4.4 Content — `TagsService` → `TagRepository` (`TAG_REPOSITORY`)
```
create(data: { name; slug }): Promise<Tag>
findById(id): Promise<Tag | null>
list(): Promise<Tag[]>                                        // orderBy name asc
update(id, data): Promise<Tag>
exists(id): Promise<boolean>
hardDelete(id): Promise<void>
slugExists(slug): Promise<boolean>
```

### 4.5 Content — `LikesService` → `PostLikeRepository` + `PostRepository`
```
// POST_LIKE_REPOSITORY (owns the PostLike model only)
findLike(postId, userId): Promise<{ id: string } | null>
createLike(postId, userId): Promise<void>      // P2002/P2025 propagate (§2.4, §10.5)
deleteLike(postId, userId): Promise<void>      // P2002/P2025 propagate
countLikes(postId): Promise<number>
// the published-post lookup is PostRepository.findPublishedIdBySlug (§4.1) — Post is its owner
```
- The published-post-id read lives **once** on `PostRepository` (it queries the
  **Post** model), injected into `LikesService` — not duplicated onto the like repo
  (adversarial finding #4; both reviewers agree). **Stays in service:** race-resilient
  toggle (swallow concurrent `P2002`/`P2025`, recompute), state assembly.

### 4.6 Content — Revisions → `RevisionRepository` (`REVISION_REPOSITORY`)
```
create(data: { postId?: string; pageId?: string; authorId: string; snapshot: Prisma.InputJsonValue }): Promise<void>
listForPost(postId): Promise<RevisionRow[]>    // orderBy createdAt desc
listForPage(pageId): Promise<RevisionRow[]>
```

### 4.7 Content — `SearchService` → `SearchRepository` (`SEARCH_REPOSITORY`)
```
searchPosts(rawQuery: string, limit: number, offset: number): Promise<SearchRow[]>
countPosts(rawQuery: string): Promise<number>   // bigint→Number(... ?? 0) coercion moves here (§10.6)
```
- Both `$queryRaw` statements move into the repo **as one unit**. The user `rawQuery`
  is passed as the **bound `Prisma.sql ${q}`** parameter (never interpolated); the
  `document`/`matches` `Prisma.sql` fragments are built **once** and reused for SELECT,
  COUNT and ORDER BY; `ORDER BY ts_rank(...) DESC, "publishedAt" DESC NULLS LAST` kept
  verbatim (§10.6). **Stays in service:** pagination math, response shaping.

### 4.8 Comments — `CommentsService` → `CommentRepository` + `PostRepository`
```
// COMMENT_REPOSITORY (owns the Comment model)
findApprovedById(id, postId): Promise<{ id: string } | null>          // parent validation
create(data: CommentCreateData): Promise<void>
listApprovedForPost(postId): Promise<FlatCommentRow[]>                // select PUBLIC fields only (no email)
listAndCount(filter: AdminCommentFilter): Promise<{ items: AdminCommentRow[]; total: number }>  // $transaction ARRAY, include post {slug,title}
exists(id): Promise<boolean>
updateStatus(id, status): Promise<AdminCommentRow>                    // include post {slug,title}
hardDelete(id): Promise<void>
// published-post lookup again = PostRepository.findPublishedIdBySlug (§4.1)
```
- **Stays in service:** reCAPTCHA verify; `buildCommentThread`; status validation. The
  never-expose-email rule is enforced by `listApprovedForPost`'s `select`.

### 4.9 Media — `MediaService` → `MediaRepository` (`MEDIA_REPOSITORY`)
```
create(data: MediaCreateData): Promise<Media>
findById(id): Promise<Media | null>
findFilename(id): Promise<string | null>
listAndCount(query): Promise<{ items: Media[]; total: number }>   // $transaction ARRAY; count() has NO where (§10.3)
update(id, data: { alt?; title?; caption? }): Promise<Media>
exists(id): Promise<boolean>
hardDelete(id): Promise<void>
```
- **Stays in service (ordering pinned, §10.2/§10.4):** byte validation; dimension
  measurement; `extensionForMime`; storage save/delete. **upload** = `storage.save` →
  `repo.create`; on create failure `storage.delete` + rethrow (catch wraps the repo
  call only). **remove** = `findFilename` → 404 if null → `storage.delete` →
  `repo.hardDelete` (storage-before-DB).

### 4.10 Auth — `AccountsService` → `UserRepository` + `AccountRepository` + `RoleRepository`
```
// USER_REPOSITORY  (4 DISTINCT user shapes — never collapse, §10.7)
findByEmailWithRole(email): Promise<UserWithRole | null>            // include role+permissions
findByIdWithRole(id): Promise<UserWithRole | null>                  // include role+permissions
createWithRole(data: UserCreateData): Promise<UserWithRole>
updateProfileFields(id, data): Promise<{ id; name; image; bio }>    // SELECT projection, not include
// ACCOUNT_REPOSITORY
findByProvider(provider, providerAccountId): Promise<AccountWithUserRole | null>  // nested include reuses permissions shape
linkToUser(userId, data): Promise<void>                            // service returns the pre-loaded user, no re-read (§10.8b)
createUserWithAccount(data): Promise<UserWithRole>                 // nested account create + emailVerified: new Date() (§10.8b)
// ROLE_REPOSITORY
findByName(name): Promise<{ id: string } | null>                   // service keeps roleId ?? null (§10.10)
```
- **Stays in service:** Argon2id hashing; decoy-hash timing defence; JWT issuance;
  permission flattening; `DEFAULT_ROLE` policy + `roleId ?? null` tolerance.

### 4.10b Admin — `AdminController` (FAT) → new `AdminService` → `UserRepository` + `RoleRepository`
The only fat controller in the codebase. Refactor:
```
// AdminService (new, in auth/accounts module) — owns the overview logic
overview(): Promise<AdminOverview>      // { users, roles } via Promise.all of the two repo counts
// UserRepository  + ROLE_REPOSITORY gain:
count(): Promise<number>                // user.count() / role.count()
```
- `AdminController.overview()` becomes `return this.admin.overview();` — no `PRISMA`
  import, no `Promise.all`, no `count()` in the controller. Guards/`@CheckPolicies`
  unchanged. The `AdminOverview` interface stays the response contract.

### 4.11 Auth — `UsersService` → `UserRepository` (admin) + `RoleRepository`
```
// USER_REPOSITORY (summary shape: role { select id,name })
listAndCount(query): Promise<{ items: UserWithRoleSummary[]; total: number }>  // $transaction ARRAY
findByIdSummary(id): Promise<UserWithRoleSummary | null>
existsById(id): Promise<boolean>
update(id, data): Promise<UserWithRoleSummary>
hardDelete(id): Promise<void>
// ROLE_REPOSITORY
list(): Promise<RoleSummaryRow[]>           // select id,name; orderBy name asc
```
- `UserWithRole` (permissions) and `UserWithRoleSummary` (`{id,name}`) are **distinct
  aliases** on the same repo — different query cost and shape; collapsing is a
  behaviour change (§10.7). **Stays in service:** search-term build, self-role-change
  & self-delete prevention, role-exists validation.

### 4.12 Authors — `AuthorsService` → `UserRepository`
```
findPublicProfile(id): Promise<{ id; name; image; bio } | null>    // 4th user shape; SELECT public fields only
```
- **Stays in service:** delegation to `PostsService.publicByAuthor`.

### 4.13 SEO/GEO — `SeoService` → `SiteProfileRepository` + `ServiceRepository` + `FaqRepository`
```
// SITE_PROFILE_REPOSITORY
get(): Promise<SiteProfile | null>                  // id:'default'; returns raw null (service maps DEFAULT_PROFILE, §10.10)
upsert(data): Promise<SiteProfile>                  // create { id:'default', ...data } vs update data (asymmetric, §10.10)
// SERVICE_REPOSITORY
list(): Promise<Service[]>                          // orderBy [order asc, createdAt asc]
create(data); update(id,data); exists(id); hardDelete(id)
// FAQ_REPOSITORY
list(): Promise<FaqItem[]>; create(data); update(id,data); exists(id); hardDelete(id)
```

### 4.14 Settings — `SettingsService` → `SettingRepository` (`SETTING_REPOSITORY`)
```
get(key): Promise<Setting | null>                   // raw null; service keeps DEFAULT_ACTIVE_THEME fallback
upsert(key, value): Promise<Setting>                // create {key,value} vs update {value} (asymmetric, §10.10)
```

### 4.15 Health — `HealthService` (unchanged)
Already depends on the minimal `DATABASE_PINGER` interface, not `PrismaClient`. **No
repository** — it is a liveness probe, not data access. Noted for audit completeness.

### Services with **no** Prisma (unchanged)
`PasswordService`, `HtmlSanitizerService`, `RecaptchaService`, `HookRegistry`,
`LocalStorageService`.

---

## 5. Test strategy (Task 4)

1. **Characterization first.** Before moving a service's data access, ensure its
   behaviour is pinned by tests, then keep them green through the move.
2. **Repository contract tests** (mocked `PrismaClient`) for every method **with real
   query shape** — assert the `where/include/select/orderBy/$transaction` issued.
   Inherited trivial forwards (§2.6) are **not** tautologically tested.
3. **Service tests against a fake repository** — the payoff of the layer.
4. **Existing specs — accurate status (corrects the first draft's false claim):**
   - **Safe, unchanged:** `slug`, `html-sanitizer`, `comments/thread`, `recaptcha`,
     `health`, `hook-registry`, `ability`, `policies.guard`, `reading-time`,
     `password`, and `media.service.spec.ts` (tests only the pure `extensionForMime`).
   - **Will break and MUST be rewritten** as part of their domain's commit (they
     construct services with a `PrismaClient`): `auth/users.service.spec.ts`,
     `auth/accounts.service.spec.ts`. Rewrite against fake repositories; they stay in
     the suite, green, after the rewrite — but they are **not** "unchanged".
5. **Coverage:** enable V8 coverage in `vitest.config.ts`; target **≥80% lines on
   services + repositories** and **100% on the critical paths** (auth
   login/register/oauth, content create/update/publish/soft-delete/restore, media
   upload, comment submit/moderate, search). Coverage is the by-product of behaviour
   tests, not the goal. Report real numbers; never assert passing without the run.
6. **E2E (Playwright)** is black-box → re-run unchanged to prove no regression. Add a
   regression test for every issue the adversarial passes surface.

---

## 6. Execution sequence

Each domain is an independently testable, committable unit. After each:
`pnpm test` green, `pnpm lint`, `pnpm typecheck`, a check that the controller stays
logic-free and the service holds no Prisma shape (§2.0), then **2–3 independent
adversarial Opus skeptics** (behaviour / correctness / security / performance) before
moving on. Order low-risk → high-risk:

1. **Scaffolding** — `packages/db` repo dir, tokens, `PrismaCrudRepository` base,
   per-module providers, barrel exports. No behaviour change.
2. **Settings → SEO/GEO → Tags → Categories** — simple CRUD; prove the pattern.
3. **Media** (storage orchestration + rollback) → **Likes** → **Comments**.
4. **Revisions** + **Search** (raw SQL).
5. **Pages → Posts** (relations, hooks, revisions — highest risk, last).
6. **Auth** (Users/Accounts/Roles — security-critical; full adversarial pass; rewrite
   the two breaking specs here).
7. **Coverage gate** + completeness-critic pass.

Then (separate later phases, architecture-first per the operator): **Task 1 parity**
and **Task 3 UI** per §7–§8.

---

## 7. Feature-parity register (Task 1) — PENDING, sequenced after architecture

From `../FEATURE_MATRIX.md` ("cmstack-ts needs"); nothing to be silently dropped:

- [ ] Per-locale **content** translation (Prisma translation tables) — biggest gap.
- [ ] Per-content **SEO meta** (metaTitle/metaDescription/canonical/noindex).
- [ ] **Password reset** + transactional **email** wiring.
- [ ] **Menu management** builder + public rendering.
- [ ] **Contact form** + email delivery (reCAPTCHA-protected).
- [ ] **GA4/GTM** injection + site-verification tags (public pages only).
- [ ] **Auto thumbnails / image processing** (decompression-bomb guard).
- [ ] **Dashboard translation editing UI** (per-locale tab strip) — after content i18n.
- [ ] **Plugin admin UI** + runtime enable/disable + render-region hooks.
- [ ] **Caching layer** (Redis + page/fragment cache, invalidate on publish via `HookRegistry`).
- [ ] Shared net-new: **revision-restore UI**, **scheduled publishing**, **RSS/Atom
      feeds**, **comment-notification email** (attaches to `HookRegistry`), **coverage
      reporting** (folded into Task 4).

### Matrix gaps / errors to flag to the operator
- **None found yet.** The matrix's "ts" claims match the code as inventoried. Any
  discrepancy found during execution is recorded here and flagged — `../FEATURE_MATRIX.md`
  is **not** edited (parallel sessions depend on it).

---

## 8. Task 3 (UI) — deferred, summary only
Conform public site + admin to `../DESIGN_SYSTEM.md` (tokens; Newsreader/Inter/Geist
Mono; components; motion; a11y), hit Lighthouse ≥95 mobile (perf/SEO/a11y/best-
practices) and WCAG 2.1 AA — measured, not assumed. Detailed plan when this phase starts.

---

## 9. Risks & rollback
- **Behaviour drift** is the only real risk of a pure refactor → mitigated by the
  pinned 134-test baseline, the §10 invariants, characterization + contract + fake-repo
  tests, and the per-domain adversarial pass. Repos return identical payloads, so DTO
  output is byte-identical.
- **Rollback unit = one domain = one commit** → revert is a single `git revert`.
- No DB migrations in Task 2 (code-only). Migrations arrive with feature parity (§7),
  shipped reversible.

---

## 10. Behaviour-preservation invariants (adversarial must-fixes)

Every executor MUST honour these; each maps to a real call in the current code.

1. **Posts m2m: create→`connect`, update→`set`.** `posts.service.ts` create uses
   `{ connect }` (add); update uses `{ set }` (replace — removes unlisted). Two
   distinct relation builders; never apply `connect` to update.
2. **Media upload ordering.** `storage.save(key)` → `repo.create(...)`; on create
   failure → `storage.delete(key)` then rethrow. The `try/catch` wraps **only** the
   repo call (the swallow/rollback boundary).
3. **Media list count.** `count()` has **no `where`** (lists all); inside the same
   `$transaction([findMany, count])` **array batch** form — do not add a filter, do
   not split into sequential awaits.
4. **Media remove ordering.** `findFilename(id)` → 404 if null → `storage.delete` →
   `repo.hardDelete` (storage-before-DB; opposite of upload).
5. **Likes race-resilience.** `createLike`/`deleteLike` let `PrismaClientKnownRequestError`
   (`P2002`/`P2025`) **propagate**; the service's `instanceof` catch swallows & recomputes.
   Repo must not catch. The post lookup queries the **Post** model
   (`PostRepository.findPublishedIdBySlug`), not `PostLike`.
6. **Search raw SQL.** Move both `$queryRaw` as one unit; `q` is a **bound** `Prisma.sql
   ${q}` param (never interpolated); `document`/`matches` fragments built once, reused
   for SELECT+COUNT+ORDER BY; keep `ts_rank(...) DESC, "publishedAt" DESC NULLS LAST`
   verbatim; keep `Number(count ?? 0)` bigint coercion in `countPosts`.
7. **Four distinct user shapes never collapse:** (a) `UserWithRole` (role+permissions
   include) for login/register/oauth/by-id; (b) `UserWithRoleSummary` (role `{id,name}`
   include) for admin list/get/update; (c) profile-update `select {id,name,image,bio}`;
   (d) author-public `select {id,name,image,bio}`. `oauth`'s nested account include
   reuses shape (a). Merging any pair changes returned fields (email/hash leak risk) or
   query cost.
8. **Categories update** uses `Prisma.CategoryUncheckedUpdateInput` with **scalar
   `parentId`**; the service keeps the `'parentId' in input` (key-present, set-null,
   skip-validation) distinction and the P2025→`mapError` translation.
   - **(8b) OAuth writes:** `linkToUser` returns `void`; the service returns the
     **already-loaded** user (no extra read). `createUserWithAccount` uses the nested
     `accounts: { create }` form and sets `emailVerified: new Date()`.
9. **Posts publish/revision ordering.** `publishedAt` stamped only when
   `existing.publishedAt === null`; hook fires only when `existing.status !== 'PUBLISHED'`
   — both decided **in the service from the pre-read `existing` before `repo.update`**.
   `hooks.emit` stays inside the success `try`, after the write. Revision `create` is a
   **separate await before** the update — **not** wrapped in a transaction with it
   (a failed update still leaves the snapshot, as today).
10. **Null-fallbacks & asymmetric upserts stay in the service / are preserved:**
    `RoleRepository.findByName` may return `null` → service keeps `roleId ?? null`;
    `SiteProfileRepository.get`/`SettingRepository.get` return raw `null` → service
    keeps `DEFAULT_PROFILE` / `DEFAULT_ACTIVE_THEME`. Upserts keep asymmetric branches:
    site profile `create {id:'default', ...data}` vs `update data`; setting
    `create {key,value}` vs `update {value}`.
11. **`$transaction` array-batch form** for `posts.list`, `users.list`,
    `comments.list`, `media.list` — `prisma.$transaction([findMany, count])`, never
    sequential awaits, never interactive `$transaction(async tx => …)`.
