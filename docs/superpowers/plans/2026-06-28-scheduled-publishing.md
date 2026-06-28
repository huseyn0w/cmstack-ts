# Scheduled publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an editor schedule a post/page to auto-publish at a future time — a DRAFT with a future `scheduledAt` flips to PUBLISHED via a once-a-minute worker.

**Architecture:** Add `scheduledAt DateTime?` to Post + Page (DRAFT stays hidden until due). A thin `@nestjs/schedule` `@Interval` calls `PostsService.publishDue`/`PagesService.publishDue`, which find due drafts and publish each through the repo (stamping `publishedAt`, clearing `scheduledAt`, emitting `post.published` + `content.changed`). The enum is untouched, so public reads/CASL/filters are unchanged.

**Tech Stack:** NestJS (CommonJS), Prisma, `@nestjs/schedule`, Next.js (Server Actions), Vitest, Zod (`@cmstack-ts/config`).

## Global Constraints

- Reply to the operator in **Russian**; code/comments/docs in **English**.
- Migration is **additive + reversible** (two nullable columns + an index). Run it via the dev DB
  per the HANDOFF recipe (`DATABASE_URL` passed explicitly to prisma).
- A scheduled item is a **DRAFT** and must never be returned by a public read until published.
- Repos never catch P2002/P2025. Auto-publish goes through `repo.update` directly (NOT
  `service.update`) so it doesn't double-snapshot/double-emit; it emits `post.published` +
  `content.changed` itself.
- Manual `status = PUBLISHED` (via create/update) clears `scheduledAt`.
- `scheduledAt` crosses the API as an ISO 8601 string, stored as `Date` (UTC).
- Import model/repo types from `@cmstack-ts/db`; shared schemas/types from `@cmstack-ts/config`.
- Service test fakes typed `Record<keyof XRepository, Mock>` cast `as unknown as X`.
- Run gates after each task: `pnpm vitest run <path>`, `pnpm typecheck`, `pnpm lint`. **Write-tool gotcha:** strip any stray trailing `</content>` line + `pnpm format`.
- **No `Co-Authored-By`/Claude trailer in commit messages.**

---

### Task 1: Prisma migration — `scheduledAt` on Post + Page

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<ts>_scheduled_publishing/migration.sql` (generated)

- [ ] **Step 1: Edit the schema** — in `packages/db/prisma/schema.prisma`, add to `model Post`
  (next to `publishedAt`) and update its index, and the same for `model Page`:

```prisma
// model Post: add the field near publishedAt
  scheduledAt     DateTime?
// model Post: add an index (alongside the existing @@index lines)
  @@index([status, scheduledAt])
```

```prisma
// model Page: add the field near status
  scheduledAt     DateTime?
// model Page: add an index
  @@index([status, scheduledAt])
```

- [ ] **Step 2: Create + apply the migration** (dev DB must be up; pass DATABASE_URL):

```bash
export DATABASE_URL="postgresql://typress:typress@localhost:5432/typress?schema=public"
pnpm --filter @cmstack-ts/db exec prisma migrate dev --name scheduled_publishing
pnpm db:generate
```

Expected: a new migration folder is created and applied; the Prisma client regenerates with
`scheduledAt` on Post + Page.

- [ ] **Step 3: Verify the migration is additive** — open the generated `migration.sql`; confirm it
  is two `ALTER TABLE ... ADD COLUMN "scheduledAt" TIMESTAMP(3)` + two `CREATE INDEX` statements
  (no drops, no NOT NULL without default).

- [ ] **Step 4: Build the package + typecheck** — `pnpm --filter @cmstack-ts/db build && pnpm typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): scheduledAt on Post + Page (scheduled publishing migration)"
```

---

### Task 2: Config — `scheduledAt` in schemas + `scheduleLabel`

**Files:**
- Modify: `packages/config/src/content.ts`
- Modify: `packages/config/src/index.ts` (export `scheduleLabel`)
- Test: `packages/config/src/content.test.ts` (create if absent) or the existing content test file

**Interfaces:**
- Produces:
  - `scheduledAt: z.string().datetime().nullable().optional()` on create post/page schemas.
  - `scheduleLabel(status: ContentStatus, scheduledAt: string | Date | null | undefined, now: Date): 'scheduled' | 'published' | 'draft'`.

- [ ] **Step 1: Write the failing test** — create `packages/config/src/content.test.ts` (or append
  to the existing content test):

```ts
import { describe, expect, it } from 'vitest';
import { createPostSchema, scheduleLabel } from './content';

const NOW = new Date('2026-06-28T12:00:00.000Z');

describe('createPostSchema scheduledAt', () => {
  it('accepts an ISO scheduledAt', () => {
    const parsed = createPostSchema.parse({ title: 'T', scheduledAt: '2026-07-01T09:00:00.000Z' });
    expect(parsed.scheduledAt).toBe('2026-07-01T09:00:00.000Z');
  });

  it('accepts null and absent', () => {
    expect(createPostSchema.parse({ title: 'T', scheduledAt: null }).scheduledAt).toBeNull();
    expect(createPostSchema.parse({ title: 'T' }).scheduledAt).toBeUndefined();
  });
});

describe('scheduleLabel', () => {
  it('labels a published item published', () => {
    expect(scheduleLabel('PUBLISHED', null, NOW)).toBe('published');
  });
  it('labels a future-dated draft scheduled', () => {
    expect(scheduleLabel('DRAFT', '2026-06-28T13:00:00.000Z', NOW)).toBe('scheduled');
  });
  it('labels a past-dated or unscheduled draft draft', () => {
    expect(scheduleLabel('DRAFT', '2026-06-28T11:00:00.000Z', NOW)).toBe('draft');
    expect(scheduleLabel('DRAFT', null, NOW)).toBe('draft');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run packages/config/src/content.test.ts` → FAIL.

- [ ] **Step 3: Implement** — in `packages/config/src/content.ts`:
  - Add `scheduledAt: z.string().datetime().nullable().optional(),` to `createPostSchema` and
    `createPageSchema` (the `.partial()` update schemas inherit it).
  - Add the helper (after the status schema):

```ts
/** UI label for an item's publish state. A future-dated DRAFT is "scheduled". */
export function scheduleLabel(
  status: ContentStatus,
  scheduledAt: string | Date | null | undefined,
  now: Date,
): 'scheduled' | 'published' | 'draft' {
  if (status === 'PUBLISHED') return 'published';
  if (scheduledAt && new Date(scheduledAt).getTime() > now.getTime()) return 'scheduled';
  return 'draft';
}
```

- [ ] **Step 4: Export** — in `packages/config/src/index.ts`, add `scheduleLabel` to the content
  export block (next to `updatePostSchema` etc.).

- [ ] **Step 5: Run to verify pass** — `pnpm vitest run packages/config/src/content.test.ts` → PASS. Then `pnpm typecheck`.

- [ ] **Step 6: Commit**

```bash
git add packages/config/src/content.ts packages/config/src/index.ts packages/config/src/content.test.ts
git commit -m "feat(config): scheduledAt schema field + scheduleLabel helper"
```

---

### Task 3: Repositories — `findDueScheduledIds` + `scheduledAt` in create/update data

**Files:**
- Modify: `packages/db/src/repositories/post.repository.ts`
- Modify: `packages/db/src/repositories/page.repository.ts`
- Test: `packages/db/src/repositories/post-page-repositories.spec.ts`

**Interfaces:**
- Produces:
  - `PostRepository.findDueScheduledIds(now: Date): Promise<{ id: string }[]>` (+ page).
  - `PostCreateData.scheduledAt?: Date | null`, `PostUpdateData.scheduledAt?: Date | null` (+ page).

- [ ] **Step 1: Write the failing test** — append to
  `packages/db/src/repositories/post-page-repositories.spec.ts`:

```ts
it('PostRepository.findDueScheduledIds queries due drafts', async () => {
  const findMany = vi.fn().mockResolvedValue([{ id: 'p1' }]);
  const prisma = { post: { findMany } } as never;
  const now = new Date('2026-06-28T12:00:00.000Z');
  const rows = await new PrismaPostRepository(prisma).findDueScheduledIds(now);
  expect(findMany).toHaveBeenCalledWith({
    where: { status: 'DRAFT', deletedAt: null, scheduledAt: { lte: now } },
    select: { id: true },
  });
  expect(rows).toEqual([{ id: 'p1' }]);
});

it('PageRepository.findDueScheduledIds queries due drafts', async () => {
  const findMany = vi.fn().mockResolvedValue([{ id: 'pg1' }]);
  const prisma = { page: { findMany } } as never;
  const now = new Date('2026-06-28T12:00:00.000Z');
  const rows = await new PrismaPageRepository(prisma).findDueScheduledIds(now);
  expect(findMany).toHaveBeenCalledWith({
    where: { status: 'DRAFT', deletedAt: null, scheduledAt: { lte: now } },
    select: { id: true },
  });
  expect(rows).toEqual([{ id: 'pg1' }]);
});
```

  (Confirm `PrismaPostRepository`/`PrismaPageRepository` are imported at the top of this spec; add
  the import if missing.)

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run packages/db/src/repositories/post-page-repositories.spec.ts` → FAIL.

- [ ] **Step 3: Implement (post)** — `packages/db/src/repositories/post.repository.ts`:
  - Add `scheduledAt?: Date | null;` to `PostCreateData` and `PostUpdateData`.
  - In `create()`'s `data:` object, add `scheduledAt: data.scheduledAt ?? null,`.
  - In `update()`'s mapping (next to the `publishedAt` line), add
    `if (data.scheduledAt !== undefined) prismaData.scheduledAt = data.scheduledAt;`.
  - Add to the `PostRepository` interface and class:

```ts
// interface
  findDueScheduledIds(now: Date): Promise<{ id: string }[]>;
```

```ts
// class
  findDueScheduledIds(now: Date): Promise<{ id: string }[]> {
    return this.prisma.post.findMany({
      where: { status: 'DRAFT', deletedAt: null, scheduledAt: { lte: now } },
      select: { id: true },
    });
  }
```

- [ ] **Step 4: Implement (page)** — `packages/db/src/repositories/page.repository.ts`: same
  changes — `scheduledAt?: Date | null` on `PageCreateData`/`PageUpdateData`, map it in
  `create()`/`update()`, and add `findDueScheduledIds` to the interface + class (using
  `this.prisma.page.findMany`).

- [ ] **Step 5: Run to verify pass** — `pnpm vitest run packages/db/src/repositories/post-page-repositories.spec.ts` → PASS. `pnpm typecheck`.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/repositories/post.repository.ts packages/db/src/repositories/page.repository.ts packages/db/src/repositories/post-page-repositories.spec.ts
git commit -m "feat(db): findDueScheduledIds + scheduledAt in post/page repo data"
```

---

### Task 4: Services — store `scheduledAt`, `publishScheduled`, `publishDue`

**Files:**
- Modify: `apps/api/src/content/posts.service.ts`
- Modify: `apps/api/src/content/pages.service.ts`
- Test: `apps/api/src/content/posts.service.spec.ts`, `apps/api/src/content/pages.service.spec.ts`

**Interfaces:**
- Consumes: `PostRepository.findDueScheduledIds` (Task 3), existing `repo.update`, `this.hooks.emit`.
- Produces:
  - `PostsService.publishScheduled(id: string): Promise<void>` / `PagesService.publishScheduled(...)`.
  - `PostsService.publishDue(now: Date): Promise<number>` / `PagesService.publishDue(...)`.
  - `create`/`update` accept `scheduledAt` (ISO string|null) and clear it on a PUBLISHED status.

- [ ] **Step 1: Write the failing tests (posts)** — append to `apps/api/src/content/posts.service.spec.ts`
  (the `posts` fake gains `findDueScheduledIds: vi.fn()` in `beforeEach`):

```ts
describe('PostsService scheduled publishing', () => {
  it('create stores scheduledAt for a draft', async () => {
    posts.create.mockResolvedValue(postRow());
    await service.create({ title: 'T', content: '', scheduledAt: '2026-07-01T09:00:00.000Z' }, 'u1');
    expect(posts.create.mock.calls[0]?.[0].scheduledAt).toEqual(new Date('2026-07-01T09:00:00.000Z'));
  });

  it('create clears scheduledAt when publishing immediately', async () => {
    posts.create.mockResolvedValue(postRow({ status: 'PUBLISHED' }));
    await service.create(
      { title: 'T', content: '', status: 'PUBLISHED', scheduledAt: '2026-07-01T09:00:00.000Z' },
      'u1',
    );
    expect(posts.create.mock.calls[0]?.[0].scheduledAt).toBeNull();
  });

  it('publishScheduled publishes a due draft and emits both events', async () => {
    posts.findActiveById.mockResolvedValue(
      postRow({ status: 'DRAFT', publishedAt: null, scheduledAt: new Date('2026-06-28T11:00:00Z') }),
    );
    posts.update.mockResolvedValue(postRow({ status: 'PUBLISHED', slug: 'title' }));
    await service.publishScheduled('p1');
    const data = posts.update.mock.calls[0]?.[1];
    expect(data.status).toBe('PUBLISHED');
    expect(data.scheduledAt).toBeNull();
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(hooks.emit).toHaveBeenCalledWith('post.published', expect.objectContaining({ id: 'p1' }));
    expect(hooks.emit).toHaveBeenCalledWith('content.changed', expect.objectContaining({ type: 'post' }));
  });

  it('publishScheduled is a no-op when the post is no longer a scheduled draft', async () => {
    posts.findActiveById.mockResolvedValue(postRow({ status: 'PUBLISHED', scheduledAt: null }));
    await service.publishScheduled('p1');
    expect(posts.update).not.toHaveBeenCalled();
  });

  it('publishDue publishes every due id', async () => {
    posts.findDueScheduledIds.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    posts.findActiveById.mockResolvedValue(
      postRow({ status: 'DRAFT', publishedAt: null, scheduledAt: new Date('2026-06-28T11:00:00Z') }),
    );
    posts.update.mockResolvedValue(postRow({ status: 'PUBLISHED' }));
    const count = await service.publishDue(new Date('2026-06-28T12:00:00Z'));
    expect(count).toBe(2);
    expect(posts.update).toHaveBeenCalledTimes(2);
  });
});
```

  `postRow` must include `scheduledAt`; add `scheduledAt: null,` to the `postRow` factory defaults.

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run apps/api/src/content/posts.service.spec.ts` → FAIL.

- [ ] **Step 3: Implement (posts)** — `apps/api/src/content/posts.service.ts`:
  - In `create`, compute and pass `scheduledAt`:

```ts
      const scheduledAt =
        status === 'PUBLISHED' ? null : input.scheduledAt ? new Date(input.scheduledAt) : null;
      const post = await this.posts.create({
        // ...existing fields...
        scheduledAt,
        authorId,
        categoryIds: input.categoryIds,
        tagIds: input.tagIds,
      });
```

  - In `update`, after the existing `status` block, add:

```ts
    if (input.scheduledAt !== undefined) {
      data.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    }
    // A manual publish cancels any pending schedule.
    if (data.status === 'PUBLISHED') data.scheduledAt = null;
```

  - Add the two methods (place near `restoreRevision`):

```ts
  /** Publish a single due draft (race-safe). Goes through repo.update directly
   * (no revision snapshot for an automated status flip) and emits the publish
   * + cache-invalidation events. */
  async publishScheduled(id: string): Promise<void> {
    const post = await this.posts.findActiveById(id);
    if (!post || post.status !== 'DRAFT' || !post.scheduledAt) return;
    const data: PostUpdateData = { status: 'PUBLISHED', scheduledAt: null };
    if (post.publishedAt === null) data.publishedAt = new Date();
    const updated = await this.posts.update(id, data);
    await this.hooks.emit('post.published', {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
    });
    await this.hooks.emit('content.changed', { type: 'post', id: updated.id, slug: updated.slug });
  }

  /** Publish all drafts whose scheduledAt is due. Returns the count published. */
  async publishDue(now: Date): Promise<number> {
    const due = await this.posts.findDueScheduledIds(now);
    for (const { id } of due) await this.publishScheduled(id);
    return due.length;
  }
```

- [ ] **Step 4: Write + run the pages tests, then implement (pages)** — mirror Steps 1+3 in
  `pages.service.spec.ts` / `pages.service.ts` (pages have no excerpt; `PageUpdateData`; `pageRow`
  factory gains `scheduledAt: null`). The `create` for pages currently has no `status === 'PUBLISHED'`
  local var — compute `const status = input.status ?? 'DRAFT';` if not already present, or derive
  `scheduledAt` from `input.status`:

```ts
    const scheduledAt =
      input.status === 'PUBLISHED' ? null : input.scheduledAt ? new Date(input.scheduledAt) : null;
```

  Add `scheduledAt` to the `pages.create({...})` call, the `update` scheduledAt block, and the two
  `publishScheduled`/`publishDue` methods (using `this.pages` + `{ type: 'page', ... }`).

- [ ] **Step 5: Run to verify pass** — `pnpm vitest run apps/api/src/content/posts.service.spec.ts apps/api/src/content/pages.service.spec.ts` → PASS. `pnpm typecheck`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/content/posts.service.ts apps/api/src/content/pages.service.ts apps/api/src/content/posts.service.spec.ts apps/api/src/content/pages.service.spec.ts
git commit -m "feat(api): scheduledAt store + publishScheduled/publishDue on posts + pages"
```

---

### Task 5: Scheduler — `@nestjs/schedule` + `ContentSchedulerService`

**Files:**
- Modify: `apps/api/package.json` (add `@nestjs/schedule`)
- Create: `apps/api/src/content/content-scheduler.service.ts`
- Test: `apps/api/src/content/content-scheduler.service.spec.ts`
- Modify: `apps/api/src/content/content.module.ts` (provide the scheduler)
- Modify: `apps/api/src/app.module.ts` (`ScheduleModule.forRoot()`)

**Interfaces:**
- Consumes: `PostsService.publishDue`, `PagesService.publishDue` (Task 4).
- Produces: `ContentSchedulerService.runDuePublish(): Promise<void>` (driven by `@Interval(60_000)`).

- [ ] **Step 1: Add the dependency** — `pnpm --filter @cmstack-ts/api add @nestjs/schedule`. Verify
  it resolves: `cd apps/api && node -e "require('@nestjs/schedule')"` → no error.

- [ ] **Step 2: Write the failing test** — `apps/api/src/content/content-scheduler.service.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ContentSchedulerService } from './content-scheduler.service';
import type { PagesService } from './pages.service';
import type { PostsService } from './posts.service';

describe('ContentSchedulerService', () => {
  it('runs publishDue on both posts and pages', async () => {
    const posts = { publishDue: vi.fn().mockResolvedValue(1) } as unknown as PostsService;
    const pages = { publishDue: vi.fn().mockResolvedValue(0) } as unknown as PagesService;
    await new ContentSchedulerService(posts, pages).runDuePublish();
    expect(posts.publishDue).toHaveBeenCalledOnce();
    expect(pages.publishDue).toHaveBeenCalledOnce();
  });

  it('swallows errors so the interval keeps running', async () => {
    const posts = { publishDue: vi.fn().mockRejectedValue(new Error('boom')) } as unknown as PostsService;
    const pages = { publishDue: vi.fn() } as unknown as PagesService;
    await expect(new ContentSchedulerService(posts, pages).runDuePublish()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to verify failure** — `pnpm vitest run apps/api/src/content/content-scheduler.service.spec.ts` → FAIL.

- [ ] **Step 4: Implement** — `apps/api/src/content/content-scheduler.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PagesService } from './pages.service';
import { PostsService } from './posts.service';

/**
 * Once-a-minute worker that auto-publishes due scheduled drafts. The interval is
 * a thin, fault-isolated trigger; all logic lives in the services.
 */
@Injectable()
export class ContentSchedulerService {
  private readonly logger = new Logger('ContentScheduler');

  constructor(
    private readonly posts: PostsService,
    private readonly pages: PagesService,
  ) {}

  @Interval(60_000)
  async runDuePublish(): Promise<void> {
    const now = new Date();
    try {
      const published = (await this.posts.publishDue(now)) + (await this.pages.publishDue(now));
      if (published > 0) this.logger.log(`Auto-published ${published} scheduled item(s)`);
    } catch (error) {
      this.logger.error('Scheduled publish run failed', error as Error);
    }
  }
}
```

- [ ] **Step 5: Provide it** — in `apps/api/src/content/content.module.ts`, add
  `ContentSchedulerService` to the `providers` array (import it at the top).

- [ ] **Step 6: Register ScheduleModule** — in `apps/api/src/app.module.ts`, add
  `import { ScheduleModule } from '@nestjs/schedule';` and `ScheduleModule.forRoot(),` to the
  `imports` array (e.g. right after `ThrottlerModule.forRoot(...)`).

- [ ] **Step 7: Run to verify pass + gates** — `pnpm vitest run apps/api/src/content/content-scheduler.service.spec.ts` → PASS; `pnpm typecheck`; `pnpm lint` (run `pnpm format` if needed).

- [ ] **Step 8: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/content/content-scheduler.service.ts apps/api/src/content/content-scheduler.service.spec.ts apps/api/src/content/content.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): minute-interval scheduler that auto-publishes due drafts"
```

---

### Task 6: Web — schedule field on forms + "Scheduled" badge

**Files:**
- Create: `apps/web/lib/admin/schedule.ts`
- Test: `apps/web/lib/admin/schedule.test.ts`
- Modify: `apps/web/components/admin/post-form.tsx`, `apps/web/components/admin/page-form.tsx`
- Modify: `apps/web/app/admin/posts/page.tsx`, `apps/web/app/admin/pages/page.tsx` (list badge)

**Interfaces:**
- Consumes: `scheduleLabel` from `@cmstack-ts/config` (Task 2).
- Produces:
  - `toDateTimeLocalValue(iso: string | null | undefined): string` — ISO → `datetime-local` value.
  - `fromDateTimeLocalValue(value: string): string | null` — `datetime-local` value → ISO (or null).

- [ ] **Step 1: Write the failing test** — `apps/web/lib/admin/schedule.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fromDateTimeLocalValue, toDateTimeLocalValue } from './schedule';

describe('datetime-local conversion', () => {
  it('empty input is null / empty', () => {
    expect(fromDateTimeLocalValue('')).toBeNull();
    expect(toDateTimeLocalValue(null)).toBe('');
    expect(toDateTimeLocalValue(undefined)).toBe('');
  });

  it('round-trips a value to the minute', () => {
    const local = '2026-07-01T09:30';
    const iso = fromDateTimeLocalValue(local);
    expect(iso).not.toBeNull();
    expect(toDateTimeLocalValue(iso)).toBe(local);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run apps/web/lib/admin/schedule.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `apps/web/lib/admin/schedule.ts`:

```ts
/** ISO → a value for `<input type="datetime-local">` (local time, minute precision). */
export function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` value (local time) → ISO 8601 string, or null when empty. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
```

- [ ] **Step 4: Run to verify pass** — `pnpm vitest run apps/web/lib/admin/schedule.test.ts` → PASS.

- [ ] **Step 5: Wire the post form** — in `apps/web/components/admin/post-form.tsx`, thread a
  `scheduledAt` field the same way the existing optional `canonicalUrl` field is threaded: add it to
  the form state (init `toDateTimeLocalValue(post?.scheduledAt)`), render a labeled control near the
  status selector, and include it in the submitted input as
  `scheduledAt: fromDateTimeLocalValue(scheduledAtValue)`:

```tsx
// control (place near the status field)
<div className="space-y-1">
  <Label htmlFor="scheduledAt">Schedule publish at</Label>
  <Input
    id="scheduledAt"
    type="datetime-local"
    value={scheduledAt}
    onChange={(e) => setScheduledAt(e.target.value)}
  />
  <p className="text-xs text-muted-foreground">
    Leave a draft with a future time to auto-publish then.
  </p>
</div>
```

  Import `toDateTimeLocalValue`/`fromDateTimeLocalValue` from `@/lib/admin/schedule`. If `PostDetail`
  does not yet carry `scheduledAt`, read it via `(post as { scheduledAt?: string | null }).scheduledAt`
  OR add `scheduledAt` to `postDetailSchema`/`postSummarySchema` (preferred — see Step 7).

- [ ] **Step 6: Wire the page form** — mirror Step 5 in `apps/web/components/admin/page-form.tsx`.

- [ ] **Step 7: Surface `scheduledAt` in the detail/summary response** — so the form can pre-fill and
  the list can badge. In `@cmstack-ts/config`, add `scheduledAt: z.string().nullable()` (ISO) to
  `postSummarySchema` and `pageDetail`/summary schemas as appropriate, and in the API
  `PostsService.toSummary`/`toDetail` (+ pages) map `scheduledAt: post.scheduledAt?.toISOString() ?? null`.
  Update the affected service specs' expected summary/detail objects.

- [ ] **Step 8: List badge** — in `apps/web/app/admin/posts/page.tsx` (and pages list), where each
  row renders its status, compute and show a Scheduled badge:

```tsx
import { scheduleLabel } from '@cmstack-ts/config';
// in the row:
const label = scheduleLabel(post.status, post.scheduledAt, new Date());
// render `label` (capitalized) in the existing status cell/badge.
```

- [ ] **Step 9: Verify** — `pnpm typecheck` clean; `pnpm lint` clean; `pnpm vitest run apps/web apps/api/src/content packages/config` green.

- [ ] **Step 10: Commit**

```bash
git add apps/web/lib/admin/schedule.ts apps/web/lib/admin/schedule.test.ts apps/web/components/admin apps/web/app/admin packages/config apps/api/src/content
git commit -m "feat(web): schedule-publish field on forms + Scheduled list badge"
```

---

### Task 7: Gates, live verification, e2e, docs, close-out

**Files:**
- Modify: `cmstack-ts/HANDOFF.md`, `REFACTOR_PLAN.md`

- [ ] **Step 1: Full unit gates** — from `cmstack-ts/`:

```bash
pnpm test          # expect ~485+ tests green
pnpm typecheck     # clean
pnpm lint          # clean
pnpm vitest run --coverage   # exit 0, lines ≥80%
```

- [ ] **Step 2: Live verification** — bring the stack up per the HANDOFF recipe (docker db [+ redis],
  `prisma migrate deploy`, seed, build, run api + web). With an admin token:
  - Create a DRAFT post with `scheduledAt` ~1 minute in the **past**
    (`POST /posts` `{ "title": "Sched", "content": "x", "status": "DRAFT", "scheduledAt": "<past ISO>" }`).
  - Confirm it is hidden publicly: `GET /public/posts/<slug>` → 404 (still DRAFT).
  - Wait up to ~65s for the interval tick; then `GET /posts/<id>` shows `status: PUBLISHED`,
    `scheduledAt: null`, `publishedAt` set; the API log shows "Auto-published 1 scheduled item(s)";
    `GET /public/posts/<slug>` now returns it.
  - Create a DRAFT with a far-**future** `scheduledAt` → stays DRAFT / hidden after a tick.

- [ ] **Step 3: E2E** — `pnpm e2e` → 11/11 (install `chromium-headless-shell` build 1148 first if it
  errors, per the HANDOFF gotcha).

- [ ] **Step 4: Adversarial self-review (inline, do NOT spawn parallel agents)** — verify: a scheduled
  draft is never returned by a public read before publish; `publishScheduled` is a no-op on a row that
  changed (race); manual PUBLISHED clears `scheduledAt`; auto-publish stamps `publishedAt` only when
  null and emits `post.published` + `content.changed`; the interval is fault-isolated. Fix any finding
  with a regression test.

- [ ] **Step 5: Update docs** — add a shared-net-new "scheduled publishing" entry to `HANDOFF.md`
  (tests/coverage, live notes, scoped-out list, new dep `@nestjs/schedule`) + refresh the
  continuation prompt's "next item" to RSS/Atom feeds. Tick the item in `REFACTOR_PLAN.md` §7 net-new.

- [ ] **Step 6: Final commit**

```bash
git add cmstack-ts/HANDOFF.md REFACTOR_PLAN.md docs/superpowers
git commit -m "docs: scheduled publishing done, refresh handoff"
```

---

## Notes for the implementer

- `@nestjs/schedule` `@Interval` fires only inside a running Nest app (needs `ScheduleModule.forRoot()`);
  unit tests call `runDuePublish()` directly, so they need neither.
- Auto-publish uses `repo.update` directly (not `service.update`) on purpose — no revision snapshot,
  no double emit. It emits `post.published` + `content.changed` itself.
- The migration needs the dev DB up with `DATABASE_URL` passed explicitly (HANDOFF gotcha); `pnpm db:generate` after so the client carries `scheduledAt`.
- Vitest resolves `@cmstack-ts/{db,config}` from `src`; `pnpm typecheck` builds packages to `dist`.
