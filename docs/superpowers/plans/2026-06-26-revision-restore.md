# Revision restore UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an editor view a post's/page's revision history, compare a revision field-by-field with the current values, and restore it (reversibly).

**Architecture:** A new `RevisionRepository.findById` feeds `PostsService.restoreRevision` / `PagesService.restoreRevision`, which parse the scalar snapshot and **reuse the existing `update`** (so the current state is snapshotted first → reversible, content is sanitized, and `content.changed` invalidates the cache). New thin controller endpoints expose it; the admin edit pages mount a reusable `RevisionsPanel` that field-compares + restores via Server Actions.

**Tech Stack:** NestJS (CommonJS), Prisma, Next.js (App Router, Server Actions), Vitest, Zod (`@cmstack-ts/config`).

## Global Constraints

- Reply to the operator in **Russian**; code/comments/docs in **English**.
- Repos never catch P2002/P2025. Restore reuses `update`, which already snapshots-before-write,
  sanitizes content, runs `uniqueSlug`, and emits `content.changed` — do not duplicate that logic.
- A revision must belong to the target (`revision.postId === id` / `revision.pageId === id`) else
  **404**; a missing revision is **404**.
- Snapshot is scalar-only (no taxonomy/translations) — restore leaves those untouched.
- Import model/repo types from `@cmstack-ts/db` (`Revision` comes via its `export * from '@prisma/client'`); never `@prisma/client` directly. Shared input schemas/types from `@cmstack-ts/config`.
- Service test fakes typed `Record<keyof XRepository, Mock>` cast `as unknown as X`.
- Run gates after each task: `pnpm vitest run <path>`, `pnpm typecheck`, `pnpm lint`. **Write-tool gotcha:** strip any stray trailing `</content>` line (`perl -0pi -e 's/\n?<\/content>\s*$//' <file>`) + `pnpm format`.
- **No `Co-Authored-By`/Claude trailer in commit messages.**

---

### Task 1: `RevisionRepository.findById`

**Files:**
- Modify: `packages/db/src/repositories/revision.repository.ts`
- Test: `packages/db/src/repositories/revision.repository.spec.ts` (create if absent)

**Interfaces:**
- Produces: `RevisionRepository.findById(id: string): Promise<Revision | null>` (Prisma `findUnique`).

- [ ] **Step 1: Write the failing test** — `packages/db/src/repositories/revision.repository.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { PrismaRevisionRepository } from './revision.repository';

describe('PrismaRevisionRepository.findById', () => {
  it('looks up a revision by id', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 'r1', postId: 'p1' });
    const prisma = { revision: { findUnique } } as never;
    const repo = new PrismaRevisionRepository(prisma);
    const row = await repo.findById('r1');
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'r1' } });
    expect(row).toEqual({ id: 'r1', postId: 'p1' });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run packages/db/src/repositories/revision.repository.spec.ts` → FAIL (`findById` not a function).

- [ ] **Step 3: Implement** — add to the `RevisionRepository` interface and `PrismaRevisionRepository`:

```ts
// in interface RevisionRepository:
  findById(id: string): Promise<Revision | null>;
```

```ts
// in class PrismaRevisionRepository:
  findById(id: string): Promise<Revision | null> {
    return this.prisma.revision.findUnique({ where: { id } });
  }
```

- [ ] **Step 4: Run to verify pass** — `pnpm vitest run packages/db/src/repositories/revision.repository.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repositories/revision.repository.ts packages/db/src/repositories/revision.repository.spec.ts
git commit -m "feat(db): RevisionRepository.findById"
```

---

### Task 2: Pure snapshot parsers

**Files:**
- Create: `apps/api/src/content/revision-snapshot.ts`
- Test: `apps/api/src/content/revision-snapshot.spec.ts`

**Interfaces:**
- Consumes: `UpdatePostInput`, `UpdatePageInput` from `@cmstack-ts/config`.
- Produces:
  - `revisionToPostUpdate(snapshot: unknown): UpdatePostInput`
  - `revisionToPageUpdate(snapshot: unknown): UpdatePageInput`
  Each maps only recognized scalar fields; `status` validated against `'DRAFT'|'PUBLISHED'`; an
  `excerpt`/field that is null/non-string is omitted (left unchanged on restore — same systemic
  optional-field-clear limitation noted for §7 #2).

- [ ] **Step 1: Write the failing test** — `apps/api/src/content/revision-snapshot.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { revisionToPageUpdate, revisionToPostUpdate } from './revision-snapshot';

describe('revisionToPostUpdate', () => {
  it('maps known scalar fields', () => {
    expect(
      revisionToPostUpdate({
        title: 'T',
        slug: 'old-slug',
        excerpt: 'E',
        content: '<p>x</p>',
        status: 'PUBLISHED',
      }),
    ).toEqual({ title: 'T', slug: 'old-slug', excerpt: 'E', content: '<p>x</p>', status: 'PUBLISHED' });
  });

  it('omits a null excerpt and an unknown status', () => {
    expect(revisionToPostUpdate({ title: 'T', excerpt: null, status: 'WAT' })).toEqual({ title: 'T' });
  });

  it('tolerates a non-object snapshot', () => {
    expect(revisionToPostUpdate(null)).toEqual({});
  });
});

describe('revisionToPageUpdate', () => {
  it('maps page scalar fields (no excerpt)', () => {
    expect(
      revisionToPageUpdate({ title: 'P', slug: 's', content: 'c', status: 'DRAFT' }),
    ).toEqual({ title: 'P', slug: 's', content: 'c', status: 'DRAFT' });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run apps/api/src/content/revision-snapshot.spec.ts` → FAIL.

- [ ] **Step 3: Implement** — `apps/api/src/content/revision-snapshot.ts`:

```ts
import type { ContentStatus, UpdatePageInput, UpdatePostInput } from '@cmstack-ts/config';

function asRecord(snapshot: unknown): Record<string, unknown> {
  return snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>) : {};
}

function status(value: unknown): ContentStatus | undefined {
  return value === 'DRAFT' || value === 'PUBLISHED' ? value : undefined;
}

/**
 * Build a post update from a revision snapshot. Only recognized scalar fields are
 * carried; a null/missing field is omitted (left unchanged on restore — taxonomy
 * and translations are not part of the snapshot).
 */
export function revisionToPostUpdate(snapshot: unknown): UpdatePostInput {
  const s = asRecord(snapshot);
  const out: UpdatePostInput = {};
  if (typeof s.title === 'string') out.title = s.title;
  if (typeof s.slug === 'string') out.slug = s.slug;
  if (typeof s.excerpt === 'string') out.excerpt = s.excerpt;
  if (typeof s.content === 'string') out.content = s.content;
  const st = status(s.status);
  if (st) out.status = st;
  return out;
}

/** Build a page update from a revision snapshot (pages have no excerpt). */
export function revisionToPageUpdate(snapshot: unknown): UpdatePageInput {
  const s = asRecord(snapshot);
  const out: UpdatePageInput = {};
  if (typeof s.title === 'string') out.title = s.title;
  if (typeof s.slug === 'string') out.slug = s.slug;
  if (typeof s.content === 'string') out.content = s.content;
  const st = status(s.status);
  if (st) out.status = st;
  return out;
}
```

- [ ] **Step 4: Run to verify pass** — `pnpm vitest run apps/api/src/content/revision-snapshot.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/content/revision-snapshot.ts apps/api/src/content/revision-snapshot.spec.ts
git commit -m "feat(api): pure revision-snapshot parsers"
```

---

### Task 3: `restoreRevision` on Posts + Pages services

**Files:**
- Modify: `apps/api/src/content/posts.service.ts`
- Modify: `apps/api/src/content/pages.service.ts`
- Test: `apps/api/src/content/posts.service.spec.ts`, `apps/api/src/content/pages.service.spec.ts`

**Interfaces:**
- Consumes: `RevisionRepository.findById` (Task 1), `revisionToPostUpdate`/`revisionToPageUpdate`
  (Task 2), the existing `this.update(id, input, authorId)`.
- Produces:
  - `PostsService.restoreRevision(id: string, revisionId: string, authorId: string): Promise<PostDetail>`
  - `PagesService.restoreRevision(id: string, revisionId: string, authorId: string): Promise<PageDetail>`

- [ ] **Step 1: Write the failing tests** — append to `apps/api/src/content/posts.service.spec.ts`
  (the `posts` fake already lists repo methods; `revisionRepo` fake already has `create/listForPost/
  listForPage` — add `findById: vi.fn()` to that fake object in `beforeEach`):

```ts
describe('PostsService.restoreRevision', () => {
  it('restores a revision by reusing update with the snapshot fields', async () => {
    revisionRepo.findById.mockResolvedValue({
      id: 'r1',
      postId: 'p1',
      pageId: null,
      authorId: 'u1',
      snapshot: { title: 'Old', slug: 'old', excerpt: null, content: 'oldbody', status: 'DRAFT' },
      createdAt: new Date(),
    });
    posts.findActiveById.mockResolvedValue(postRow());
    posts.update.mockResolvedValue(postRow({ title: 'Old' }));
    const detail = await service.restoreRevision('p1', 'r1', 'editor-1');
    expect(posts.update).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ title: 'Old', slug: 'old', content: 'oldbody', status: 'DRAFT' }),
      'editor-1',
    );
    expect(detail.title).toBe('Old');
  });

  it('404s when the revision is missing', async () => {
    revisionRepo.findById.mockResolvedValue(null);
    await expect(service.restoreRevision('p1', 'rX', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    expect(posts.update).not.toHaveBeenCalled();
  });

  it('404s when the revision belongs to a different post', async () => {
    revisionRepo.findById.mockResolvedValue({ id: 'r1', postId: 'other', snapshot: {} });
    await expect(service.restoreRevision('p1', 'r1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    expect(posts.update).not.toHaveBeenCalled();
  });
});
```

  And to `apps/api/src/content/pages.service.spec.ts` (add `findById: vi.fn()` to the `revisionRepo`
  fake in `beforeEach`):

```ts
describe('PagesService.restoreRevision', () => {
  it('restores a page revision via update', async () => {
    revisionRepo.findById.mockResolvedValue({
      id: 'r1',
      postId: null,
      pageId: 'pg1',
      authorId: 'u1',
      snapshot: { title: 'Old', slug: 'old', content: 'b', status: 'DRAFT' },
      createdAt: new Date(),
    });
    pages.findActiveById.mockResolvedValue(pageRow());
    pages.update.mockResolvedValue(pageRow({ title: 'Old' }));
    const detail = await service.restoreRevision('pg1', 'r1', 'editor-1');
    expect(pages.update).toHaveBeenCalledWith(
      'pg1',
      expect.objectContaining({ title: 'Old', slug: 'old', content: 'b', status: 'DRAFT' }),
      'editor-1',
    );
    expect(detail.title).toBe('Old');
  });

  it('404s when the revision belongs to another page', async () => {
    revisionRepo.findById.mockResolvedValue({ id: 'r1', pageId: 'other', snapshot: {} });
    await expect(service.restoreRevision('pg1', 'r1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    expect(pages.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run apps/api/src/content/posts.service.spec.ts apps/api/src/content/pages.service.spec.ts` → FAIL.

- [ ] **Step 3: Implement (posts)** — in `apps/api/src/content/posts.service.ts`, add the import
  `import { revisionToPostUpdate } from './revision-snapshot';` and a method (place after `revisions`):

```ts
  /** Restore a prior revision's scalar fields. Reuses update (snapshots current
   * state first → reversible; sanitizes; emits content.changed). */
  async restoreRevision(id: string, revisionId: string, authorId: string): Promise<PostDetail> {
    const revision = await this.revisionRepo.findById(revisionId);
    if (!revision || revision.postId !== id) throw new NotFoundException('Revision not found.');
    return this.update(id, revisionToPostUpdate(revision.snapshot), authorId);
  }
```

- [ ] **Step 4: Implement (pages)** — in `apps/api/src/content/pages.service.ts`, add
  `import { revisionToPageUpdate } from './revision-snapshot';` and (after `revisions`):

```ts
  /** Restore a prior page revision's scalar fields (reuses update). */
  async restoreRevision(id: string, revisionId: string, authorId: string): Promise<PageDetail> {
    const revision = await this.revisionRepo.findById(revisionId);
    if (!revision || revision.pageId !== id) throw new NotFoundException('Revision not found.');
    return this.update(id, revisionToPageUpdate(revision.snapshot), authorId);
  }
```

- [ ] **Step 5: Run to verify pass** — `pnpm vitest run apps/api/src/content/posts.service.spec.ts apps/api/src/content/pages.service.spec.ts` → PASS. Then `pnpm typecheck`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/content/posts.service.ts apps/api/src/content/pages.service.ts apps/api/src/content/posts.service.spec.ts apps/api/src/content/pages.service.spec.ts
git commit -m "feat(api): restoreRevision on posts + pages services"
```

---

### Task 4: Controller endpoints

**Files:**
- Modify: `apps/api/src/content/posts.controller.ts`
- Modify: `apps/api/src/content/pages.controller.ts`

**Interfaces:**
- Consumes: `PostsService.restoreRevision` / `PagesService.restoreRevision` (Task 3).
- Produces: `POST /posts/:id/revisions/:revisionId/restore`, `POST /pages/:id/revisions/:revisionId/restore`.

- [ ] **Step 1: Implement (posts)** — in `apps/api/src/content/posts.controller.ts`, add after the
  existing `revisions` handler (mirrors the existing `restore` handler; `@CurrentUser` + `AuthenticatedUser`
  are already imported in this file):

```ts
  @Post(':id/revisions/:revisionId/restore')
  @CheckPolicies((ability) => ability.can('update', 'Post'))
  restoreRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PostDetail> {
    return this.posts.restoreRevision(id, revisionId, user.id);
  }
```

- [ ] **Step 2: Implement (pages)** — in `apps/api/src/content/pages.controller.ts`, add the analogous
  handler (check this file's imports include `CurrentUser`/`AuthenticatedUser`/`PageDetail`; add any
  missing import the same way `posts.controller.ts` declares them):

```ts
  @Post(':id/revisions/:revisionId/restore')
  @CheckPolicies((ability) => ability.can('update', 'Page'))
  restoreRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PageDetail> {
    return this.pages.restoreRevision(id, revisionId, user.id);
  }
```

- [ ] **Step 3: Verify** — `pnpm typecheck` clean; `pnpm vitest run apps/api/src/content` green.
- [ ] **Step 4: Commit**

```bash
git add apps/api/src/content/posts.controller.ts apps/api/src/content/pages.controller.ts
git commit -m "feat(api): restore-revision endpoints for posts + pages"
```

---

### Task 5: Web field-compare helper

**Files:**
- Create: `apps/web/lib/admin/revision-compare.ts`
- Test: `apps/web/lib/admin/revision-compare.test.ts`

**Interfaces:**
- Produces:
  - `interface RevisionView { id: string; authorId: string | null; snapshot: unknown; createdAt: string }`
  - `interface RevisionField { key: string; label: string }`
  - `interface FieldCompare { key: string; label: string; current: string; revision: string; changed: boolean }`
  - `compareRevisionFields(current: Record<string, unknown>, snapshot: unknown, fields: RevisionField[]): FieldCompare[]`
    — stringifies each field's current vs snapshot value (null/undefined → ''), flags `changed`.

- [ ] **Step 1: Write the failing test** — `apps/web/lib/admin/revision-compare.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { compareRevisionFields } from './revision-compare';

const FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'content', label: 'Content' },
];

describe('compareRevisionFields', () => {
  it('flags changed fields and renders both values', () => {
    const result = compareRevisionFields(
      { title: 'New', content: 'body' },
      { title: 'Old', content: 'body' },
      FIELDS,
    );
    expect(result).toEqual([
      { key: 'title', label: 'Title', current: 'New', revision: 'Old', changed: true },
      { key: 'content', label: 'Content', current: 'body', revision: 'body', changed: false },
    ]);
  });

  it('treats null/undefined as empty strings', () => {
    const [title] = compareRevisionFields({ title: null }, {}, [{ key: 'title', label: 'Title' }]);
    expect(title).toEqual({ key: 'title', label: 'Title', current: '', revision: '', changed: false });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run apps/web/lib/admin/revision-compare.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `apps/web/lib/admin/revision-compare.ts`:

```ts
export interface RevisionView {
  id: string;
  authorId: string | null;
  snapshot: unknown;
  createdAt: string;
}

export interface RevisionField {
  key: string;
  label: string;
}

export interface FieldCompare {
  key: string;
  label: string;
  current: string;
  revision: string;
  changed: boolean;
}

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Compare current values against a revision snapshot, field by field. */
export function compareRevisionFields(
  current: Record<string, unknown>,
  snapshot: unknown,
  fields: RevisionField[],
): FieldCompare[] {
  const snap = snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>) : {};
  return fields.map(({ key, label }) => {
    const c = str(current[key]);
    const r = str(snap[key]);
    return { key, label, current: c, revision: r, changed: c !== r };
  });
}
```

- [ ] **Step 4: Run to verify pass** — `pnpm vitest run apps/web/lib/admin/revision-compare.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/admin/revision-compare.ts apps/web/lib/admin/revision-compare.test.ts
git commit -m "feat(web): pure revision field-compare helper"
```

---

### Task 6: RevisionsPanel + Server Actions + mount on edit pages

**Files:**
- Create: `apps/web/components/admin/revisions-panel.tsx`
- Modify: `apps/web/app/admin/posts/actions.ts`, `apps/web/app/admin/pages/actions.ts`
- Modify: `apps/web/app/admin/posts/[id]/edit/page.tsx`, `apps/web/app/admin/pages/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `compareRevisionFields`, `RevisionView`, `RevisionField` (Task 5); `apiGet`/`apiSend`
  (`@/lib/admin/api`); the new restore endpoints (Task 4).
- Produces:
  - Server Actions `restorePostRevisionAction(id: string, revisionId: string): Promise<ActionResult>`
    and `restorePageRevisionAction(id: string, revisionId: string): Promise<ActionResult>`.
  - `<RevisionsPanel contentType="post"|"page" id current revisions fields restoreAction />` client component.

- [ ] **Step 1: Add Server Actions** — append to `apps/web/app/admin/posts/actions.ts` (mirrors
  `restorePostAction`'s shape; `apiSend`/`ActionResult`/`revalidatePath` already imported):

```ts
export async function restorePostRevisionAction(
  id: string,
  revisionId: string,
): Promise<ActionResult> {
  try {
    await apiSend('POST', `/posts/${id}/revisions/${revisionId}/restore`);
    revalidatePath('/admin/posts');
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to restore revision' };
  }
}
```

  And the analogous `restorePageRevisionAction` in `apps/web/app/admin/pages/actions.ts` (POST to
  `/pages/${id}/revisions/${revisionId}/restore`, `revalidatePath('/admin/pages')` + `'/','layout'`).

- [ ] **Step 2: Build the panel** — `apps/web/components/admin/revisions-panel.tsx` (client
  component; follow the structure/styling of `components/admin/translations-panel.tsx` — section
  heading, list, `useTransition`, `sonner` toast). It receives the current values, the revisions
  array, the compare `fields`, and the bound `restoreAction`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import {
  type FieldCompare,
  type RevisionField,
  type RevisionView,
  compareRevisionFields,
} from '@/lib/admin/revision-compare';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

interface RevisionsPanelProps {
  id: string;
  current: Record<string, unknown>;
  revisions: RevisionView[];
  fields: RevisionField[];
  restoreAction: (id: string, revisionId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

export function RevisionsPanel({ id, current, revisions, fields, restoreAction }: RevisionsPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (revisions.length === 0) {
    return (
      <section className="mt-10 border-t pt-6">
        <h2 className="text-lg font-semibold">Revisions</h2>
        <p className="mt-2 text-sm text-muted-foreground">No revisions yet.</p>
      </section>
    );
  }

  const active = revisions.find((r) => r.id === selected) ?? null;
  const diff: FieldCompare[] = active ? compareRevisionFields(current, active.snapshot, fields) : [];

  function onRestore(revisionId: string) {
    startTransition(async () => {
      const result = await restoreAction(id, revisionId);
      if (result.ok) toast.success('Revision restored');
      else toast.error(result.error);
    });
  }

  return (
    <section className="mt-10 border-t pt-6">
      <h2 className="text-lg font-semibold">Revisions</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Restoring saves the current version as a new revision first, so it is reversible.
      </p>
      <ul className="mt-4 divide-y rounded-md border">
        {revisions.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-4 p-3">
            <button
              type="button"
              className="text-left text-sm hover:underline"
              onClick={() => setSelected(r.id === selected ? null : r.id)}
            >
              {new Date(r.createdAt).toLocaleString()} · {r.authorId ?? 'unknown'}
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onRestore(r.id)}
            >
              Restore
            </Button>
          </li>
        ))}
      </ul>
      {active && (
        <div className="mt-4 space-y-3">
          {diff.map((f) => (
            <div key={f.key} className="rounded-md border p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {f.label} {f.changed ? '· changed' : ''}
              </p>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] text-muted-foreground">Current</p>
                  <p className={`text-sm ${f.changed ? 'bg-destructive/10' : ''}`}>{truncate(f.current)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Revision</p>
                  <p className={`text-sm ${f.changed ? 'bg-primary/10' : ''}`}>{truncate(f.revision)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function truncate(value: string, max = 400): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
```

  (Values render as **escaped React text** — no `dangerouslySetInnerHTML`. If `Button` is imported
  from a different path in this repo, match the path used by `translations-panel.tsx`.)

- [ ] **Step 3: Mount on the post edit page** — in `apps/web/app/admin/posts/[id]/edit/page.tsx`:
  import the panel + action + `RevisionView`, fetch revisions, render the panel below the form.

```tsx
// imports
import { RevisionsPanel } from '@/components/admin/revisions-panel';
import type { RevisionView } from '@/lib/admin/revision-compare';
import { restorePostRevisionAction } from '../../actions';

const POST_REVISION_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'slug', label: 'Slug' },
  { key: 'excerpt', label: 'Excerpt' },
  { key: 'content', label: 'Content' },
  { key: 'status', label: 'Status' },
];

async function fetchRevisions(id: string): Promise<RevisionView[]> {
  try {
    return await apiGet<RevisionView[]>(`/posts/${id}/revisions`);
  } catch {
    return [];
  }
}
```

  Add `fetchRevisions(id)` to the existing `Promise.all`, and after the form (and the existing
  `TranslationsPanel`) render:

```tsx
        <RevisionsPanel
          id={post.id}
          current={{
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt ?? '',
            content: post.content,
            status: post.status,
          }}
          revisions={revisions}
          fields={POST_REVISION_FIELDS}
          restoreAction={restorePostRevisionAction}
        />
```

- [ ] **Step 4: Mount on the page edit page** — mirror Step 3 in
  `apps/web/app/admin/pages/[id]/edit/page.tsx` with `restorePageRevisionAction`,
  `PAGE_REVISION_FIELDS` (title/slug/content/status — no excerpt), and `current` built from the
  page detail (no excerpt).

- [ ] **Step 5: Verify** — `pnpm typecheck` clean; `pnpm lint` clean (run `pnpm format` if it flags
  import order); `pnpm vitest run apps/web` green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/admin/revisions-panel.tsx apps/web/app/admin/posts apps/web/app/admin/pages
git commit -m "feat(web): revisions panel with field-compare + restore"
```

---

### Task 7: Gates, live verification, e2e, docs, close-out

**Files:**
- Modify: `cmstack-ts/HANDOFF.md`, `REFACTOR_PLAN.md`

- [ ] **Step 1: Full unit gates** — from `cmstack-ts/`:

```bash
pnpm test          # expect ~470+ tests green
pnpm typecheck     # clean
pnpm lint          # clean
pnpm vitest run --coverage   # exit 0, lines ≥80%
```

- [ ] **Step 2: Live verification** — bring the stack up per the HANDOFF recipe (docker db [+ redis],
  migrate deploy, seed, build, run api+web). Then, with an admin token:
  - Get a post id; PATCH it twice with different titles (creates revisions).
  - `GET /posts/:id/revisions` → list has ≥1 entry; note an older `revisionId`.
  - `POST /posts/:id/revisions/:revisionId/restore` → 200; `GET /posts/:id` shows the restored title;
    `GET /posts/:id/revisions` now has one MORE entry (the pre-restore state) → **reversible**.
  - Cross-item restore (`revisionId` from another post) → **404**.
  - Admin UI: open `/admin/posts/<id>/edit`, the Revisions section lists entries; selecting one shows
    the field compare; clicking Restore re-saves and toasts.

- [ ] **Step 3: E2E** — `pnpm e2e` → 11/11 (install `chromium-headless-shell` build 1148 first if it
  errors, per the HANDOFF gotcha).

- [ ] **Step 4: Adversarial self-review (inline, do NOT spawn parallel agents)** — verify: cross-item
  restore is 404 (no cross-content leak); restore on a trashed post → 404 via `update`'s
  `findActiveById`; restored content is sanitized (same `update` path); the cache is invalidated
  (`content.changed` from `update`); restore writes a reversible snapshot; rendered field values are
  escaped React text. Fix any finding with a regression test.

- [ ] **Step 5: Update docs** — add a shared-net-new "revision restore UI" entry to `HANDOFF.md`
  (tests/coverage, live notes, scoped-out list) + refresh the continuation prompt's "next item" to
  the next net-new (scheduled publishing). Tick the item in `REFACTOR_PLAN.md` §7 net-new list.

- [ ] **Step 6: Final commit**

```bash
git add cmstack-ts/HANDOFF.md REFACTOR_PLAN.md docs/superpowers
git commit -m "docs: revision-restore UI done, refresh handoff"
```

---

## Notes for the implementer

- `Revision` is available from `@cmstack-ts/db` via its `export * from '@prisma/client'`.
- Restore deliberately reuses `update` — do NOT write a separate repo-level restore; the reuse is
  what makes it reversible + sanitized + cache-invalidating.
- The `excerpt`/optional-clear limitation (a snapshot whose excerpt was empty won't clear a current
  non-empty excerpt) is the same systemic form-pattern limitation noted for §7 #2 — acceptable.
- Vitest resolves `@cmstack-ts/{db,config}` from `src`; `pnpm typecheck` builds packages to `dist`.
