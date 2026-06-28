# Shared net-new #2 — Scheduled publishing — Design

**Date:** 2026-06-28 · **Status:** approved · **Register:** `REFACTOR_PLAN.md` §7 shared net-new; canon `../FEATURE_MATRIX.md` row 26 ("Scheduled (future) publishing — `scheduledAt` + a worker/cron that auto-publishes due content" — a gap in all three stacks)

## Goal

Let an editor schedule a post/page to publish automatically at a future time. A draft with a
future `scheduledAt` auto-transitions to PUBLISHED when its time arrives.

## Context (in place)

- `ContentStatus` enum is `DRAFT | PUBLISHED`. Posts and pages have `status` + `publishedAt`
  (stamped once on first publish, preserved thereafter) + `deletedAt` soft-delete.
- Public reads only ever return PUBLISHED, non-trashed content — so a DRAFT is already hidden.
- `PostsService.update`/`PagesService.update` snapshot the prior state, run the status transition,
  and `emit('post.published')` on the transition into PUBLISHED; §7 #10 made every content write
  `emit('content.changed')` to invalidate the cache.
- `@nestjs/schedule` is **not** yet a dependency. The adapter pattern (nodemailer/sharp/ioredis) —
  a feature-justified new dep — is the established precedent.
- Admin post/page forms post a full `Create/Update{Post,Page}Input` through Server Actions.

## Decisions

- **Status model: keep `DRAFT` + a new `scheduledAt DateTime?`** (operator choice). A DRAFT with a
  future `scheduledAt` is "scheduled"; the worker flips it to PUBLISHED when `scheduledAt <= now`.
  The enum is untouched, so public reads / CASL / status filters need **no change** (a scheduled
  item is a hidden DRAFT until published). The "Scheduled" label is derived in the UI.
- **Scope: posts AND pages** (operator choice) — both have a status/publish transition; the
  mechanism is shared.
- **Scheduler: `@nestjs/schedule`** (new dep, feature-justified). `ScheduleModule.forRoot()` in
  `AppModule`; a thin `ContentSchedulerService` runs `@Interval` once a minute and calls the
  services' `publishDue(now)` — all real logic lives in the services (unit-tested), the cron is a
  thin, fault-isolated trigger.
- **Auto-publish reuses the repo write, not the service `update`**: `publishScheduled(id)` loads
  the active row, no-ops if it is no longer a DRAFT or lost its `scheduledAt` (race-safe), else
  `repo.update(id, { status: 'PUBLISHED', scheduledAt: null, publishedAt: stampIfNull })` and then
  emits `post.published` + `content.changed`. It deliberately does **not** snapshot a revision (an
  automated status flip is not a content edit) — logged.
- **Manual publish clears the schedule:** when `create`/`update` sets `status = PUBLISHED`,
  `scheduledAt` is forced to `null` (the schedule is moot once published).
- **Time handling:** `scheduledAt` is an ISO 8601 string at the API boundary, stored as a
  `DateTime` (UTC). The admin `datetime-local` input is interpreted as the browser's local time and
  serialized to ISO before sending. No extra timezone modeling.
- **Single-process worker:** one API process runs the interval. Multi-instance correctness (an
  advisory lock so two workers don't double-publish) is out of scope (logged).

## Data model (migration, additive/reversible)

- `Post.scheduledAt DateTime?`, `Page.scheduledAt DateTime?`.
- `@@index([status, scheduledAt])` on each (the worker query filters `status = DRAFT` +
  `scheduledAt <= now`).

## Components

- **`@cmstack-ts/config`:** add `scheduledAt: z.string().datetime().nullable().optional()` to
  `createPostSchema`, `updatePostSchema` (`.partial()` of create — inherited), `createPageSchema`,
  `updatePageSchema`. Pure `scheduleLabel(status, scheduledAt, now): 'scheduled' | 'published' | 'draft'`
  (`scheduled` when `DRAFT` and `scheduledAt` is in the future) — shared, unit-tested.
- **`packages/db`:** `PostRepository.findDueScheduledIds(now: Date): Promise<{ id: string }[]>`
  (`where status='DRAFT', deletedAt=null, scheduledAt:{ lte: now }`), same for `PageRepository`.
  `PostCreateData`/`PostUpdateData` (+ page equivalents) gain `scheduledAt?: Date | null`.
- **API services** (`PostsService`/`PagesService`):
  - `create`/`update` map `scheduledAt` (ISO string → `Date`, empty/absent → unchanged/`null`);
    when the effective status is `PUBLISHED`, force `scheduledAt = null`.
  - `publishScheduled(id: string): Promise<void>` — race-safe single publish (above).
  - `publishDue(now: Date): Promise<number>` — `findDueScheduledIds` then `publishScheduled` each;
    returns the count published.
- **`ContentSchedulerService`** (content module): `@Interval(60_000)` `runDuePublish()` →
  `try { await posts.publishDue(now); await pages.publishDue(now); } catch (log)`. Registered as a
  provider; `ScheduleModule.forRoot()` added to `AppModule`.
- **Web:** a `datetime-local` "Schedule publish at" field on the post/page forms bound to
  `scheduledAt` (serialized to ISO on submit; pre-filled from an existing value). The admin list
  rows show a **Scheduled** badge via `scheduleLabel`.

## Behaviour invariants

- A scheduled item is a DRAFT and is **never** returned by a public read until the worker publishes
  it.
- Auto-publish stamps `publishedAt` only if it was null (first publish), clears `scheduledAt`, and
  emits `post.published` + `content.changed` exactly like a manual publish (minus the revision
  snapshot).
- The worker is race-safe: if the row changed between the due-query and the publish (already
  published, un-scheduled, or trashed), `publishScheduled` is a no-op.
- Setting `status = PUBLISHED` manually clears any pending `scheduledAt`.

## Testing (TDD by layer)

1. `@cmstack-ts/config`: `scheduledAt` parses (ISO, nullable, optional); `scheduleLabel` cases
   (future DRAFT → scheduled; past DRAFT → draft; PUBLISHED → published).
2. `PostRepository.findDueScheduledIds` / `PageRepository...` contract tests (mock Prisma `findMany`
   where clause).
3. `PostsService`/`PagesService`: `publishScheduled` (DRAFT+due → repo.update PUBLISHED +
   publishedAt + scheduledAt null + emits both events; non-DRAFT → no-op); `publishDue` loops;
   `create`/`update` store `scheduledAt`; manual PUBLISHED clears it.
4. `ContentSchedulerService`: `runDuePublish` calls both services' `publishDue` (fake services);
   a throw is swallowed.
5. Web: `scheduleLabel` (re-exported from config) used by the list badge — covered by the config
   unit test; form wiring verified live.
6. Full gates (`pnpm test` / `typecheck` / `lint` / coverage ≥80%); rebuild + `pnpm e2e` 11/11;
   live: create a DRAFT with `scheduledAt` a minute in the past → within one tick it becomes
   PUBLISHED (visible publicly), `scheduledAt` cleared, `post.published` logged; a far-future
   schedule stays a hidden DRAFT.

## Out of scope (logged, not silent)

- A revision snapshot on auto-publish (automated status flip, not an edit); a dedicated
  "unschedule" UX (clear the field or publish manually); timezone modeling beyond ISO/UTC; a
  distributed worker lock for multi-instance deploys (single-process today); scheduled
  *unpublish*/expiry.
