# Contact Form + Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, reCAPTCHA-protected contact form that persists submissions (admin inbox) and emails a settings-driven recipient via the observer.

**Architecture:** New NestJS `contact` module (`controller → ContactService → ContactRepository`); the service persists then `emit('contact.submitted')`; a fault-isolated `ContactMailListener` sends the email through the §7 #3 `MailService`. Recipient resolves `SiteProfile.contactEmail → CONTACT_RECIPIENT_EMAIL → MAIL_FROM`. Web adds `/[locale]/contact` (form) + `/admin/contact` (inbox).

**Tech Stack:** NestJS 10 (CommonJS), Prisma + Postgres, Zod (`@cmstack-ts/config`), `@nestjs/throttler`, existing `RecaptchaService` + `MailService` + `HookRegistry`, Next.js 15 App Router, Vitest, Biome.

## Global Constraints
- Three-layer rule: controller thin; service owns logic + observer; repository framework-free, returns Prisma payloads, **never catches P2002/P2025** (REFACTOR_PLAN §2.0/§2.4).
- Repo file exports `interface XRepository`, `X_REPOSITORY` Symbol, `PrismaXRepository`; trivial CRUD extends `PrismaCrudRepository`. Wire via `provideRepository(TOKEN, Impl)`.
- Service tests use fakes typed `Record<keyof XRepository, Mock>` cast `as unknown as X`. Import model + repo types from `@cmstack-ts/db`; tests construct Prisma errors from `@cmstack-ts/db`'s `Prisma`, never `@prisma/client`.
- `emit` runs after the repo write, inside the success path; fault-isolated — a listener failure must not fail the request (§2.7). No new event beyond `contact.submitted`.
- Migrations additive/reversible. Coverage ≥80% on services+repos. Code/comments/docs English; operator replies Russian. **No `Co-Authored-By` trailer in commits.**
- **Write-tool gotcha:** after any `Write`, strip a stray trailing `</content>` line: `perl -0pi -e 's/\n?<\/content>\s*$//' <file>` then `pnpm format`.
- `packages/db` prisma commands need `DATABASE_URL` passed explicitly; docker `db` (DB `typress`, creds `typress/typress/typress`) is likely up.
- Public submit returns `201`/`204` only (never reflects stored data); honeypot path is indistinguishable from success.

---

### Task 1: Config schemas + pure recipient resolver

**Files:**
- Create: `packages/config/src/contact.ts`
- Create: `packages/config/src/contact.test.ts`
- Modify: `packages/config/src/index.ts` (re-export)
- Modify: `packages/config/src/seo.ts` (add `contactEmail` to profile schemas)
- Modify: `packages/config/src/seo.test.ts` (cover the new field) — only if the file asserts the full profile shape; otherwise skip

**Interfaces:**
- Produces: `contactSubmissionSchema`/`ContactSubmissionInput`, `adminContactSchema`/`AdminContact`, `adminContactListSchema`/`AdminContactList`, `updateContactSchema`/`UpdateContactInput`, pure `resolveContactRecipient(profileEmail, envEmail, fromEmail)`.
- Modifies: `updateSiteProfileSchema`/`siteProfileSchema` gain `contactEmail`.

- [ ] **Step 1: Write the failing test** — `packages/config/src/contact.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contactSubmissionSchema, resolveContactRecipient } from './contact';

describe('contactSubmissionSchema', () => {
  it('accepts a valid submission', () => {
    const r = contactSubmissionSchema.safeParse({
      name: 'Ada', email: 'ada@x.test', message: 'Hello there', subject: 'Hi',
    });
    expect(r.success).toBe(true);
  });
  it('rejects a bad email', () => {
    expect(contactSubmissionSchema.safeParse({ name: 'A', email: 'nope', message: 'hi' }).success).toBe(false);
  });
  it('rejects an empty message', () => {
    expect(contactSubmissionSchema.safeParse({ name: 'A', email: 'a@x.test', message: '' }).success).toBe(false);
  });
  it('allows the optional honeypot field', () => {
    const r = contactSubmissionSchema.safeParse({ name: 'A', email: 'a@x.test', message: 'hi', company: 'bot' });
    expect(r.success).toBe(true);
  });
});

describe('resolveContactRecipient', () => {
  it('prefers the profile email', () => {
    expect(resolveContactRecipient('p@x.test', 'e@x.test', 'f@x.test')).toBe('p@x.test');
  });
  it('falls back to env then from', () => {
    expect(resolveContactRecipient('', 'e@x.test', 'f@x.test')).toBe('e@x.test');
    expect(resolveContactRecipient('', '', 'f@x.test')).toBe('f@x.test');
  });
  it('ignores whitespace-only values', () => {
    expect(resolveContactRecipient('  ', '  ', 'f@x.test')).toBe('f@x.test');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/config/src/contact.test.ts`
Expected: FAIL — cannot resolve `./contact`.

- [ ] **Step 3: Write `packages/config/src/contact.ts`:**

```ts
import { z } from 'zod';

/**
 * Contact form contracts. All fields are plain text (rendered escaped + sent as
 * a text email). `company` is a honeypot — real users leave it empty.
 */
export const contactSubmissionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
  recaptchaToken: z.string().optional(),
  company: z.string().optional(),
});
export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;

export const adminContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  subject: z.string().nullable(),
  message: z.string(),
  handledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type AdminContact = z.infer<typeof adminContactSchema>;

export const adminContactListSchema = z.array(adminContactSchema);
export type AdminContactList = z.infer<typeof adminContactListSchema>;

export const updateContactSchema = z.object({ handled: z.boolean() });
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

/** Resolve the contact recipient: profile email → env → MAIL_FROM (first non-blank). */
export function resolveContactRecipient(
  profileEmail: string,
  envEmail: string | undefined,
  fromEmail: string,
): string {
  const candidates = [profileEmail, envEmail ?? '', fromEmail];
  for (const c of candidates) {
    if (c.trim() !== '') return c.trim();
  }
  return fromEmail;
}
```

- [ ] **Step 4: Add `contactEmail` to the SEO profile schemas** — in `packages/config/src/seo.ts`, the file already has `const optionalUrl = ...`. Add an `optionalEmail` and the field. In `updateSiteProfileSchema` add:

```ts
  contactEmail: z.literal('').or(z.string().trim().email().max(200)).default(''),
```
and in `siteProfileSchema` add `contactEmail: z.string(),`.

- [ ] **Step 5: Re-export from `packages/config/src/index.ts`** — append:

```ts
export {
  contactSubmissionSchema,
  type ContactSubmissionInput,
  adminContactSchema,
  type AdminContact,
  adminContactListSchema,
  type AdminContactList,
  updateContactSchema,
  type UpdateContactInput,
  resolveContactRecipient,
} from './contact';
```

- [ ] **Step 6: Run tests + build config**

Run: `pnpm vitest run packages/config/src/contact.test.ts && pnpm --filter @cmstack-ts/config build`
Expected: PASS; config builds clean. (If `seo.test.ts` asserts the exact profile object shape, add `contactEmail: ''` to its fixtures.)

- [ ] **Step 7: Strip artifact + format + commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' packages/config/src/contact.ts packages/config/src/contact.test.ts
pnpm format
git add packages/config/src
git commit -m "feat(config): contact form schemas + recipient resolver; profile contactEmail"
```

---

### Task 2: Prisma schema + migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (add `ContactSubmission`; add `contactEmail` to `SiteProfile`)
- Create: migration `packages/db/prisma/migrations/<ts>_contact_submissions/migration.sql`

**Interfaces:**
- Produces: Prisma model `ContactSubmission`; `SiteProfile.contactEmail` column.

- [ ] **Step 1: Add the model + column to `schema.prisma`** (place the model in the SEO section near `SiteProfile`):

```prisma
/// A message sent through the public contact form. Persisted for the admin inbox;
/// delivery to the recipient is a fault-isolated side effect (contact.submitted).
model ContactSubmission {
  id        String    @id @default(cuid())
  name      String
  email     String
  subject   String?
  message   String
  /// Set when an admin marks the message handled (null = new/unhandled).
  handledAt DateTime?
  createdAt DateTime  @default(now())

  @@index([createdAt])
}
```
And add to the existing `model SiteProfile { ... }` (after `geoStatement`):
```prisma
  /// Recipient for contact-form notifications. Empty falls back to env/MAIL_FROM.
  contactEmail     String   @default("")
```

- [ ] **Step 2: Create the migration (no reset — shared DB):**

```bash
export DATABASE_URL="postgresql://typress:typress@localhost:5432/typress?schema=public"
pnpm --filter @cmstack-ts/db exec prisma migrate dev --name contact_submissions --create-only
```

- [ ] **Step 3: Review `migration.sql`** — confirm it only `CREATE TABLE "ContactSubmission"` + its index and `ALTER TABLE "SiteProfile" ADD COLUMN "contactEmail" TEXT NOT NULL DEFAULT ''`. No destructive statements.

- [ ] **Step 4: Apply + generate**

```bash
pnpm --filter @cmstack-ts/db exec prisma migrate deploy
pnpm db:generate
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): ContactSubmission model + SiteProfile.contactEmail migration"
```

---

### Task 3: ContactRepository + contract tests

**Files:**
- Create: `packages/db/src/repositories/contact-submission.repository.ts`
- Create: `packages/db/src/repositories/contact-submission.repository.spec.ts`
- Modify: `packages/db/src/repositories/index.ts` (barrel export)

**Interfaces:**
- Consumes: `PrismaCrudRepository`; `PrismaClient`, `ContactSubmission` from `@prisma/client`.
- Produces: `CONTACT_SUBMISSION_REPOSITORY` Symbol, `ContactSubmissionRepository` interface, `PrismaContactSubmissionRepository`, `ContactSubmissionCreateData`.
  - `create(data: ContactSubmissionCreateData): Promise<ContactSubmission>`
  - `list(): Promise<ContactSubmission[]>` (orderBy createdAt desc)
  - `setHandledAt(id, when: Date | null): Promise<ContactSubmission>`
  - `exists(id): Promise<boolean>` / `hardDelete(id): Promise<void>` (inherited)

- [ ] **Step 1: Write the contract test** — `packages/db/src/repositories/contact-submission.repository.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaContactSubmissionRepository } from './contact-submission.repository';

// biome-ignore lint/suspicious/noExplicitAny: in-test Prisma double
let p: any;
let repo: PrismaContactSubmissionRepository;

beforeEach(() => {
  p = {
    contactSubmission: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
  };
  repo = new PrismaContactSubmissionRepository(p);
});

describe('PrismaContactSubmissionRepository', () => {
  it('create persists the provided fields', async () => {
    p.contactSubmission.create.mockResolvedValue({ id: 'c1' });
    await repo.create({ name: 'Ada', email: 'a@x.test', subject: null, message: 'hi' });
    expect(p.contactSubmission.create).toHaveBeenCalledWith({
      data: { name: 'Ada', email: 'a@x.test', subject: null, message: 'hi' },
    });
  });

  it('list orders by createdAt desc', async () => {
    p.contactSubmission.findMany.mockResolvedValue([]);
    await repo.list();
    expect(p.contactSubmission.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
  });

  it('setHandledAt updates the timestamp', async () => {
    const when = new Date('2026-06-25T00:00:00.000Z');
    p.contactSubmission.update.mockResolvedValue({ id: 'c1', handledAt: when });
    await repo.setHandledAt('c1', when);
    expect(p.contactSubmission.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { handledAt: when } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/db/src/repositories/contact-submission.repository.spec.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write `contact-submission.repository.ts`:**

```ts
import type { ContactSubmission, PrismaClient } from '@prisma/client';
import { PrismaCrudRepository } from './crud.repository';

export type ContactSubmissionCreateData = {
  name: string;
  email: string;
  subject: string | null;
  message: string;
};

export interface ContactSubmissionRepository {
  create(data: ContactSubmissionCreateData): Promise<ContactSubmission>;
  list(): Promise<ContactSubmission[]>;
  setHandledAt(id: string, when: Date | null): Promise<ContactSubmission>;
  exists(id: string): Promise<boolean>;
  hardDelete(id: string): Promise<void>;
}

export const CONTACT_SUBMISSION_REPOSITORY = Symbol('CONTACT_SUBMISSION_REPOSITORY');

export class PrismaContactSubmissionRepository
  extends PrismaCrudRepository
  implements ContactSubmissionRepository
{
  constructor(private readonly prisma: PrismaClient) {
    super(prisma.contactSubmission);
  }

  create(data: ContactSubmissionCreateData): Promise<ContactSubmission> {
    return this.prisma.contactSubmission.create({ data });
  }

  list(): Promise<ContactSubmission[]> {
    return this.prisma.contactSubmission.findMany({ orderBy: { createdAt: 'desc' } });
  }

  setHandledAt(id: string, when: Date | null): Promise<ContactSubmission> {
    return this.prisma.contactSubmission.update({ where: { id }, data: { handledAt: when } });
  }
}
```

- [ ] **Step 4: Barrel export** — add to `packages/db/src/repositories/index.ts`: `export * from './contact-submission.repository';`

- [ ] **Step 5: Run tests + build db**

Run: `pnpm vitest run packages/db/src/repositories/contact-submission.repository.spec.ts && pnpm --filter @cmstack-ts/db build`
Expected: PASS; db builds.

- [ ] **Step 6: Strip artifact + format + commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' packages/db/src/repositories/contact-submission.repository.ts packages/db/src/repositories/contact-submission.repository.spec.ts
pnpm format
git add packages/db/src/repositories
git commit -m "feat(db): ContactSubmission repository + contract tests"
```

---

### Task 4: Pure contact-notification email builder

**Files:**
- Create: `apps/api/src/mail/contact-notification-email.ts`
- Create: `apps/api/src/mail/contact-notification-email.spec.ts`

**Interfaces:**
- Consumes: `MailMessage` from `./mail-transport`.
- Produces: `contactNotificationEmail(input: { name; email; subject: string | null; message: string }): Omit<MailMessage, 'to'>`.

- [ ] **Step 1: Write the failing test** — `contact-notification-email.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contactNotificationEmail } from './contact-notification-email';

describe('contactNotificationEmail', () => {
  it('includes the sender name, email and message in the text body', () => {
    const msg = contactNotificationEmail({ name: 'Ada', email: 'ada@x.test', subject: 'Hi', message: 'Hello' });
    expect(msg.text).toContain('Ada');
    expect(msg.text).toContain('ada@x.test');
    expect(msg.text).toContain('Hello');
    expect(msg.subject).toContain('Hi');
  });

  it('escapes HTML in the HTML body to prevent injection', () => {
    const msg = contactNotificationEmail({
      name: '<script>', email: 'a@x.test', subject: null, message: '<b>x</b>',
    });
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('&lt;script&gt;');
    expect(msg.html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('uses a default subject when none is given', () => {
    const msg = contactNotificationEmail({ name: 'A', email: 'a@x.test', subject: null, message: 'm' });
    expect(msg.subject).toBe('New contact form message');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/api/src/mail/contact-notification-email.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `contact-notification-email.ts`** (mirror `password-reset-email.ts`'s `escapeHtml`):

```ts
import type { MailMessage } from './mail-transport';

/** Escape the five HTML-significant characters so user input can't break out of markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build the contact-form notification email. Pure (no I/O) so copy + escaping are
 * unit-tested. All fields come from an untrusted public submission, so the HTML
 * body escapes every value.
 */
export function contactNotificationEmail(input: {
  name: string;
  email: string;
  subject: string | null;
  message: string;
}): Omit<MailMessage, 'to'> {
  const subject = input.subject?.trim()
    ? `Contact form: ${input.subject.trim()}`
    : 'New contact form message';

  const text = [
    'You received a new message through the contact form.',
    '',
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    ...(input.subject ? [`Subject: ${input.subject}`] : []),
    '',
    input.message,
  ].join('\n');

  const html = [
    '<p>You received a new message through the contact form.</p>',
    `<p><strong>Name:</strong> ${escapeHtml(input.name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(input.email)}</p>`,
    ...(input.subject ? [`<p><strong>Subject:</strong> ${escapeHtml(input.subject)}</p>`] : []),
    `<p>${escapeHtml(input.message).replace(/\n/g, '<br>')}</p>`,
  ].join('\n');

  return { subject, text, html };
}
```

Note the default subject must equal `'New contact form message'` (the test asserts it).

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run apps/api/src/mail/contact-notification-email.spec.ts`
Expected: PASS.

- [ ] **Step 5: Strip artifact + format + commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' apps/api/src/mail/contact-notification-email.ts apps/api/src/mail/contact-notification-email.spec.ts
pnpm format
git add apps/api/src/mail
git commit -m "feat(api): pure contact-notification email builder"
```

---

### Task 5: ActionMap hook + ContactService + tests

**Files:**
- Modify: `apps/api/src/plugins/hooks.ts` (add `contact.submitted` to `ActionMap`)
- Create: `apps/api/src/contact/contact.service.ts`
- Create: `apps/api/src/contact/contact.service.spec.ts`

**Interfaces:**
- Consumes: `CONTACT_SUBMISSION_REPOSITORY`/`ContactSubmissionRepository` from `@cmstack-ts/db`; `RecaptchaService`; `HookRegistry`; config types.
- Produces: `ContactService` with:
  - `submit(input: ContactSubmissionInput): Promise<void>` (honeypot drop; recaptcha; persist; emit)
  - `list(): Promise<AdminContact[]>`
  - `setHandled(id, handled: boolean): Promise<AdminContact>` (404 on P2025)
  - `remove(id): Promise<void>` (404 if absent)
  - `ActionMap['contact.submitted'] = { id; name; email; subject: string | null; message: string }`

- [ ] **Step 1: Add the hook** — in `apps/api/src/plugins/hooks.ts`, extend `ActionMap`:

```ts
  /**
   * Fired after a contact-form submission is stored. The contact module's mail
   * listener sends the notification email; fault-isolated, so a mail failure
   * never fails the public submit.
   */
  'contact.submitted': { id: string; name: string; email: string; subject: string | null; message: string };
```

- [ ] **Step 2: Write the failing service test** — `apps/api/src/contact/contact.service.spec.ts`:

```ts
import { type ContactSubmissionRepository, Prisma } from '@cmstack-ts/db';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactService } from './contact.service';

let repo: Record<keyof ContactSubmissionRepository, Mock>;
let recaptcha: { verify: Mock };
let hooks: { emit: Mock };
let service: ContactService;

const row = {
  id: 'c1', name: 'Ada', email: 'a@x.test', subject: null, message: 'hi',
  handledAt: null, createdAt: new Date('2026-06-25T00:00:00.000Z'),
};

beforeEach(() => {
  repo = {
    create: vi.fn().mockResolvedValue(row),
    list: vi.fn(),
    setHandledAt: vi.fn(),
    exists: vi.fn(),
    hardDelete: vi.fn(),
  };
  recaptcha = { verify: vi.fn().mockResolvedValue(true) };
  hooks = { emit: vi.fn().mockResolvedValue(undefined) };
  service = new ContactService(
    repo as unknown as ContactSubmissionRepository,
    recaptcha as never,
    hooks as never,
  );
});

describe('submit', () => {
  it('drops a honeypot-filled submission without storing or emitting', async () => {
    await service.submit({ name: 'A', email: 'a@x.test', message: 'hi', company: 'bot' });
    expect(repo.create).not.toHaveBeenCalled();
    expect(hooks.emit).not.toHaveBeenCalled();
  });

  it('rejects when the recaptcha check fails', async () => {
    recaptcha.verify.mockResolvedValue(false);
    await expect(service.submit({ name: 'A', email: 'a@x.test', message: 'hi' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('persists then emits contact.submitted', async () => {
    await service.submit({ name: 'Ada', email: 'a@x.test', message: 'hi', subject: 'Hi' });
    expect(repo.create).toHaveBeenCalledWith({ name: 'Ada', email: 'a@x.test', subject: 'Hi', message: 'hi' });
    expect(hooks.emit).toHaveBeenCalledWith('contact.submitted', {
      id: 'c1', name: 'Ada', email: 'a@x.test', subject: null, message: 'hi',
    });
  });
});

describe('admin', () => {
  it('lists submissions mapped to the response shape', async () => {
    repo.list.mockResolvedValue([row]);
    const list = await service.list();
    expect(list[0]).toMatchObject({ id: 'c1', email: 'a@x.test', handledAt: null });
    expect(typeof list[0].createdAt).toBe('string');
  });

  it('maps P2025 to 404 on setHandled', async () => {
    repo.setHandledAt.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5' }),
    );
    await expect(service.setHandled('c1', true)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s removing a missing submission', async () => {
    repo.exists.mockResolvedValue(false);
    await expect(service.remove('c1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run apps/api/src/contact/contact.service.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write `apps/api/src/contact/contact.service.ts`:**

```ts
import {
  CONTACT_SUBMISSION_REPOSITORY,
  type ContactSubmission,
  type ContactSubmissionRepository,
  Prisma,
} from '@cmstack-ts/db';
import type { AdminContact, ContactSubmissionInput } from '@cmstack-ts/config';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { HookRegistry } from '../plugins/hook-registry';
import { RecaptchaService } from '../spam/recaptcha.service';

@Injectable()
export class ContactService {
  constructor(
    @Inject(CONTACT_SUBMISSION_REPOSITORY) private readonly repo: ContactSubmissionRepository,
    private readonly recaptcha: RecaptchaService,
    private readonly hooks: HookRegistry,
  ) {}

  async submit(input: ContactSubmissionInput): Promise<void> {
    // Honeypot: a real browser never fills `company`. Silently accept + drop so a
    // bot can't tell it was filtered (no enumeration of the filter).
    if (input.company && input.company.trim() !== '') return;

    const passed = await this.recaptcha.verify(input.recaptchaToken);
    if (!passed) throw new BadRequestException('Spam check failed. Please try again.');

    const created = await this.repo.create({
      name: input.name,
      email: input.email,
      subject: input.subject ?? null,
      message: input.message,
    });
    // Side effect: notify the recipient. Fault-isolated — a mail failure can't fail
    // the already-stored submission or the public 201 (§2.7).
    await this.hooks.emit('contact.submitted', {
      id: created.id,
      name: created.name,
      email: created.email,
      subject: created.subject,
      message: created.message,
    });
  }

  async list(): Promise<AdminContact[]> {
    const rows = await this.repo.list();
    return rows.map((r) => this.toAdmin(r));
  }

  async setHandled(id: string, handled: boolean): Promise<AdminContact> {
    try {
      const row = await this.repo.setHandledAt(id, handled ? new Date() : null);
      return this.toAdmin(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Contact submission not found');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repo.exists(id))) throw new NotFoundException('Contact submission not found');
    await this.repo.hardDelete(id);
  }

  private toAdmin(r: ContactSubmission): AdminContact {
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      subject: r.subject,
      message: r.message,
      handledAt: r.handledAt ? r.handledAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
```

- [ ] **Step 5: Run tests until green**

Run: `pnpm vitest run apps/api/src/contact/contact.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Strip artifact + format + commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' apps/api/src/contact/contact.service.ts apps/api/src/contact/contact.service.spec.ts
pnpm format
git add apps/api/src/contact apps/api/src/plugins/hooks.ts
git commit -m "feat(api): ContactService (honeypot, recaptcha, persist, emit contact.submitted)"
```

---

### Task 6: Mail listener + tests

**Files:**
- Create: `apps/api/src/contact/contact-mail.listener.ts`
- Create: `apps/api/src/contact/contact-mail.listener.spec.ts`

**Interfaces:**
- Consumes: `MailService`; `SITE_PROFILE_REPOSITORY`/`SiteProfileRepository` from `@cmstack-ts/db`; `contactNotificationEmail` (Task 4); `resolveContactRecipient` (Task 1); `ActionMap['contact.submitted']` payload.
- Produces: `ContactMailListener` with `handle(payload): Promise<void>` (resolves recipient, sends mail). Registered on `HookRegistry` in Task 7's module `onModuleInit`.

- [ ] **Step 1: Write the failing test** — `contact-mail.listener.spec.ts`:

```ts
import type { SiteProfileRepository } from '@cmstack-ts/db';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactMailListener } from './contact-mail.listener';

let profiles: { get: Mock };
let mail: { send: Mock };
let listener: ContactMailListener;

const payload = { id: 'c1', name: 'Ada', email: 'a@x.test', subject: null, message: 'hi' };

beforeEach(() => {
  profiles = { get: vi.fn() };
  mail = { send: vi.fn().mockResolvedValue(undefined) };
  listener = new ContactMailListener(
    profiles as unknown as SiteProfileRepository,
    mail as never,
  );
});

describe('ContactMailListener', () => {
  it('sends to the profile contactEmail when set', async () => {
    profiles.get.mockResolvedValue({ contactEmail: 'owner@x.test' });
    await listener.handle(payload);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send.mock.calls[0][0].to).toBe('owner@x.test');
  });

  it('falls back to MAIL_FROM when no profile email and no env', async () => {
    const prev = process.env.CONTACT_RECIPIENT_EMAIL;
    process.env.CONTACT_RECIPIENT_EMAIL = '';
    profiles.get.mockResolvedValue({ contactEmail: '' });
    await listener.handle(payload);
    // from defaults to 'Cmstack-TS <noreply@localhost>' — non-empty recipient resolved
    expect(mail.send.mock.calls[0][0].to).toBeTruthy();
    process.env.CONTACT_RECIPIENT_EMAIL = prev;
  });

  it('does not throw when the profile lookup returns null', async () => {
    profiles.get.mockResolvedValue(null);
    await expect(listener.handle(payload)).resolves.toBeUndefined();
    expect(mail.send).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run apps/api/src/contact/contact-mail.listener.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `contact-mail.listener.ts`:**

```ts
import { SITE_PROFILE_REPOSITORY, type SiteProfileRepository } from '@cmstack-ts/db';
import { resolveContactRecipient } from '@cmstack-ts/config';
import { Inject, Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { contactNotificationEmail } from '../mail/contact-notification-email';
import type { ActionMap } from '../plugins/hooks';

/**
 * Sends the contact-form notification email when a submission is stored. Wired to
 * the `contact.submitted` action in the module's onModuleInit. emit() is
 * fault-isolated, so a failure here is logged and swallowed — it never fails the
 * public submit.
 */
@Injectable()
export class ContactMailListener {
  constructor(
    @Inject(SITE_PROFILE_REPOSITORY) private readonly profiles: SiteProfileRepository,
    private readonly mail: MailService,
  ) {}

  async handle(payload: ActionMap['contact.submitted']): Promise<void> {
    const profile = await this.profiles.get();
    const recipient = resolveContactRecipient(
      profile?.contactEmail ?? '',
      process.env.CONTACT_RECIPIENT_EMAIL,
      process.env.MAIL_FROM?.trim() || 'Cmstack-TS <noreply@localhost>',
    );
    const message = contactNotificationEmail({
      name: payload.name,
      email: payload.email,
      subject: payload.subject,
      message: payload.message,
    });
    await this.mail.send({ to: recipient, ...message });
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run apps/api/src/contact/contact-mail.listener.spec.ts`
Expected: PASS.

- [ ] **Step 5: Strip artifact + format + commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' apps/api/src/contact/contact-mail.listener.ts apps/api/src/contact/contact-mail.listener.spec.ts
pnpm format
git add apps/api/src/contact
git commit -m "feat(api): contact mail listener (recipient resolution + send)"
```

---

### Task 7: Controllers + module wiring + CASL subject

**Files:**
- Create: `apps/api/src/contact/contact.controller.ts` (admin, gated `Contact`)
- Create: `apps/api/src/contact/public-contact.controller.ts` (public, throttled)
- Create: `apps/api/src/contact/contact.module.ts`
- Modify: `apps/api/src/app.module.ts` (import `ContactModule`)
- Modify: `apps/api/src/seo/seo.service.ts` + its DEFAULT_PROFILE (include `contactEmail: ''`)

**Interfaces:**
- Consumes: `ContactService`, `ContactMailListener`, `HookRegistry`, repository providers.
- Produces: REST routes per the spec.

- [ ] **Step 1: Write `public-contact.controller.ts`:**

```ts
import { type ContactSubmissionInput, contactSubmissionSchema } from '@cmstack-ts/config';
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ContactService } from './contact.service';

@Controller('public/contact')
export class PublicContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async submit(
    @Body(new ZodValidationPipe(contactSubmissionSchema)) body: ContactSubmissionInput,
  ): Promise<{ ok: true }> {
    await this.contact.submit(body);
    return { ok: true };
  }
}
```

- [ ] **Step 2: Write `contact.controller.ts`** — thin admin controller, every route `@CheckPolicies((a) => a.can('<action>', 'Contact'))`:

```ts
import {
  type AdminContact,
  type AdminContactList,
  type UpdateContactInput,
  updateContactSchema,
} from '@cmstack-ts/config';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ContactService } from './contact.service';

@Controller('contact')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  @CheckPolicies((a) => a.can('read', 'Contact'))
  list(): Promise<AdminContactList> {
    return this.contact.list();
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Contact'))
  setHandled(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateContactSchema)) body: UpdateContactInput,
  ): Promise<AdminContact> {
    return this.contact.setHandled(id, body.handled);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('delete', 'Contact'))
  async remove(@Param('id') id: string): Promise<void> {
    await this.contact.remove(id);
  }
}
```

- [ ] **Step 3: Write `contact.module.ts`** (registers the listener in onModuleInit):

```ts
import {
  CONTACT_SUBMISSION_REPOSITORY,
  PrismaContactSubmissionRepository,
  PrismaSiteProfileRepository,
  SITE_PROFILE_REPOSITORY,
} from '@cmstack-ts/db';
import { Module, type OnModuleInit } from '@nestjs/common';
import { AccountsModule } from '../auth/accounts.module';
import { MailModule } from '../mail/mail.module';
import { provideRepository } from '../persistence/repository.providers';
import { HookRegistry } from '../plugins/hook-registry';
import { PluginsModule } from '../plugins/plugins.module';
import { SpamModule } from '../spam/spam.module';
import { ContactController } from './contact.controller';
import { ContactMailListener } from './contact-mail.listener';
import { ContactService } from './contact.service';
import { PublicContactController } from './public-contact.controller';

@Module({
  imports: [AccountsModule, MailModule, SpamModule, PluginsModule],
  controllers: [ContactController, PublicContactController],
  providers: [
    ContactService,
    ContactMailListener,
    provideRepository(CONTACT_SUBMISSION_REPOSITORY, PrismaContactSubmissionRepository),
    provideRepository(SITE_PROFILE_REPOSITORY, PrismaSiteProfileRepository),
  ],
})
export class ContactModule implements OnModuleInit {
  constructor(
    private readonly hooks: HookRegistry,
    private readonly listener: ContactMailListener,
  ) {}

  onModuleInit(): void {
    this.hooks.addAction('contact.submitted', (payload) => this.listener.handle(payload));
  }
}
```

Verify `PluginsModule` exports `HookRegistry` and `SpamModule` exports `RecaptchaService` (both do — `RecaptchaService` is used by comments; `HookRegistry` by `PostsService`). If `SpamModule` does not export `RecaptchaService`, add it to its `exports`.

- [ ] **Step 4: Register in `app.module.ts`** — add `ContactModule` to `imports` (mirror `CommentsModule`).

- [ ] **Step 5: Include `contactEmail` in the SEO default profile** — in `apps/api/src/seo/seo.service.ts`, find `DEFAULT_PROFILE` (the fallback returned when no row is stored) and add `contactEmail: ''` so the mapped shape matches `siteProfileSchema`. Also ensure `updateProfile` passes `contactEmail` through (it spreads the validated body, so no change needed beyond the schema).

- [ ] **Step 6: Add the `Contact` CASL subject** — `grep -rn "'Comment'" apps/api/src/authz` to confirm subjects are free strings (they are; no union to edit). No authz code change; the seed grant (Task 8) is what matters.

- [ ] **Step 7: Typecheck + lint + run contact specs**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run apps/api/src/contact`
Expected: clean; tests green.

- [ ] **Step 8: Commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' apps/api/src/contact/*.ts
pnpm format
git add apps/api/src/contact apps/api/src/app.module.ts apps/api/src/seo/seo.service.ts
git commit -m "feat(api): contact public + admin controllers, module wiring, listener registration"
```

---

### Task 8: Seed (contactEmail + demo submissions + CASL grant)

**Files:**
- Modify: `packages/db/prisma/seed.ts`

- [ ] **Step 1: Add `{ action: 'manage', subject: 'Contact' }`** to the global `PERMISSIONS` list and to the **Editor** role's permission list (mirroring the `Comment` lines).

- [ ] **Step 2: Set `contactEmail` on the seeded profile** — find where the SiteProfile is upserted (the `seedSeo` function). Add `contactEmail: ADMIN_EMAIL` to both the `create` and `update` data (so the demo recipient is the admin address).

- [ ] **Step 3: Add a `seedContact()` function** (idempotent: only when the table is empty):

```ts
async function seedContact() {
  const existing = await prisma.contactSubmission.count();
  if (existing > 0) return;
  await prisma.contactSubmission.createMany({
    data: [
      {
        name: 'Jamie Rivera',
        email: 'jamie@example.com',
        subject: 'Partnership idea',
        message: 'Loved the demo — would like to talk about a content partnership.',
        handledAt: new Date(),
      },
      {
        name: 'Sam Okoye',
        email: 'sam@example.com',
        subject: null,
        message: 'Is there an RSS feed for the engineering posts?',
      },
    ],
  });
}
```

- [ ] **Step 4: Call it in `main()`** — after `await seedComments();` add `await seedContact();`.

- [ ] **Step 5: Seed against the live DB**

```bash
export DATABASE_URL="postgresql://typress:typress@localhost:5432/typress?schema=public"
pnpm db:seed
```
Expected: completes; re-run does not duplicate submissions (count guard).

- [ ] **Step 6: Commit**

```bash
git add packages/db/prisma/seed.ts
git commit -m "feat(db): seed contactEmail + demo contact submissions + Contact permission"
```

---

### Task 9: Web — public contact form

**Files:**
- Create: `apps/web/app/[locale]/contact/page.tsx`
- Create: `apps/web/components/public/contact-form.tsx`
- Modify: `apps/web/messages/en.json`, `de.json`, `ru.json` (new `contact` namespace)

**Interfaces:**
- Consumes: `getActiveTheme()`, `alternatesFor`, next-intl `getTranslations`/`useTranslations`; `NEXT_PUBLIC_API_URL`.

- [ ] **Step 1: Add the `contact` message namespace** to all three `messages/*.json` (keys in parity). English:

```json
"contact": {
  "title": "Contact",
  "intro": "Have a question or a project in mind? Send us a message.",
  "name": "Name",
  "email": "Email",
  "subject": "Subject",
  "message": "Message",
  "send": "Send message",
  "success": "Thanks — your message has been sent.",
  "error": "Something went wrong. Please try again."
}
```
German (`de.json`): title "Kontakt", intro "Haben Sie eine Frage oder ein Projekt? Schreiben Sie uns.", name "Name", email "E-Mail", subject "Betreff", message "Nachricht", send "Nachricht senden", success "Danke — Ihre Nachricht wurde gesendet.", error "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut." Russian (`ru.json`): title "Контакты", intro "Есть вопрос или проект? Напишите нам.", name "Имя", email "Эл. почта", subject "Тема", message "Сообщение", send "Отправить сообщение", success "Спасибо — ваше сообщение отправлено.", error "Что-то пошло не так. Попробуйте ещё раз."

- [ ] **Step 2: Write `components/public/contact-form.tsx`** (client; posts directly to the API):

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function ContactForm() {
  const t = useTranslations('contact');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setStatus('idle');
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${base}/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          subject: data.get('subject') || undefined,
          message: data.get('message'),
          company: data.get('company') || undefined,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('ok');
      form.reset();
    } catch {
      setStatus('err');
    } finally {
      setPending(false);
    }
  }

  const field = { width: '100%', padding: '0.6rem 0.75rem', background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--line)', borderRadius: 4, font: 'inherit' } as const;

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 560 }}>
      {/* Honeypot: hidden from users; bots that fill it are silently dropped. */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>{t('name')}</span>
        <input name="name" required maxLength={120} style={field} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>{t('email')}</span>
        <input name="email" type="email" required maxLength={200} style={field} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>{t('subject')}</span>
        <input name="subject" maxLength={200} style={field} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>{t('message')}</span>
        <textarea name="message" required maxLength={5000} rows={6} style={field} />
      </label>
      <button type="submit" disabled={pending} className="ts-cta" style={{ alignSelf: 'flex-start', padding: '0.6rem 1.25rem', cursor: 'pointer' }}>
        {t('send')}
      </button>
      {status === 'ok' && <p style={{ color: 'var(--fg)' }}>{t('success')}</p>}
      {status === 'err' && <p style={{ color: 'crimson' }}>{t('error')}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Write `app/[locale]/contact/page.tsx`:**

```tsx
import { ContactForm } from '@/components/public/contact-form';
import { alternatesFor } from '@/lib/i18n/metadata';
import { getActiveTheme } from '@/themes/active-theme';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('contact');
  return { title: t('title'), alternates: alternatesFor(locale, '/contact') };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [{ Layout }, t] = await Promise.all([getActiveTheme(), getTranslations('contact')]);

  return (
    <Layout>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', margin: '0 0 1rem' }}>{t('title')}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 18, lineHeight: 1.6, margin: '0 0 2.5rem' }}>{t('intro')}</p>
        <ContactForm />
      </div>
    </Layout>
  );
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' apps/web/components/public/contact-form.tsx "apps/web/app/[locale]/contact/page.tsx"
pnpm format
git add apps/web/components/public/contact-form.tsx "apps/web/app/[locale]/contact" apps/web/messages
git commit -m "feat(web): public localized contact form posting to the API"
```

---

### Task 10: Web — admin inbox + SEO contactEmail field

**Files:**
- Create: `apps/web/app/admin/contact/page.tsx`
- Create: `apps/web/app/admin/contact/actions.ts`
- Create: `apps/web/app/admin/contact/contact-inbox.tsx`
- Modify: `apps/web/lib/admin/guard.ts` (add `canManageContacts`)
- Modify: `apps/web/app/admin/layout.tsx` + `apps/web/components/admin/admin-shell.tsx` (thread + nav entry "Contact" under Moderation)
- Modify: `apps/web/app/admin/seo/profile-form.tsx` (add the Contact email input) + ensure the SEO page's `DEFAULT_PROFILE` includes `contactEmail: ''`

**Interfaces:**
- Consumes: server-only `apiGet`/`apiSend`; `adminContactListSchema`/`AdminContact`.

- [ ] **Step 1: Add `canManageContacts`** to `guard.ts` (mirror `canModerateComments`, subject `'Contact'`).

- [ ] **Step 2: Thread `canManageContacts`** through `admin/layout.tsx` (import + pass `canManageContacts={canManageContacts(session)}`) and `admin-shell.tsx`: add to `AdminShellProps`, `buildNavGroups` signature + call, the Sidebar prop type + both Sidebar usages, and a nav item under the existing **Moderation** group:

```tsx
{ label: 'Contact', href: '/admin/contact', icon: <Inbox className="h-4 w-4" /> }
```
(import `Inbox` from `lucide-react`), gated by `canManageContacts`; and add `if (pathname.startsWith('/admin/contact')) return 'Contact';` to `getSectionLabel`. The Moderation group is currently created only when `canModerateComments`; change it to build the items array conditionally so Contact shows when `canManageContacts` even if comments are off.

- [ ] **Step 3: Server Actions** — `actions.ts` (`'use server'`): `setHandled(id, handled)` → `apiSend('PATCH', '/contact/'+id, { handled })`; `deleteSubmission(id)` → `apiSend('DELETE', '/contact/'+id)`; each `revalidatePath('/admin/contact')`. Return `{ ok }` like `seo/actions.ts`.

- [ ] **Step 4: Inbox page** — `page.tsx` (server): `requireAdminSession()` + `canManageContacts` gate (redirect `/admin` otherwise); `apiGet('/contact', adminContactListSchema)` (catch → `[]`); render `<ContactInbox items={...} />`.

- [ ] **Step 5: `contact-inbox.tsx`** (client) — newest-first cards: name, email (mailto link), subject, message (escaped text, `whiteSpace: 'pre-wrap'`), received date, a handled badge; per-row "Mark handled"/"Mark unhandled" + "Delete" buttons calling the actions via `useTransition` + `sonner` toasts. Mirror `seo/entry-crud.tsx` structure.

- [ ] **Step 6: SEO contactEmail field** — in `apps/web/app/admin/seo/profile-form.tsx`, add a "Contact email" `<Input type="email">` bound to a `contactEmail` field in the form state, included in the `updateProfile` payload. In `apps/web/app/admin/seo/page.tsx`, add `contactEmail: ''` to its local `DEFAULT_PROFILE`.

- [ ] **Step 7: Typecheck + lint + build web**

Run: `pnpm typecheck && pnpm lint && pnpm --filter @cmstack-ts/web build`
Expected: clean build; `/admin/contact` + `/[locale]/contact` in the route manifest.

- [ ] **Step 8: Commit**

```bash
perl -0pi -e 's/\n?<\/content>\s*$//' apps/web/app/admin/contact/*.tsx apps/web/app/admin/contact/*.ts
pnpm format
git add apps/web/app/admin/contact apps/web/lib/admin/guard.ts apps/web/app/admin/layout.tsx apps/web/components/admin/admin-shell.tsx apps/web/app/admin/seo
git commit -m "feat(web): admin contact inbox + SEO contactEmail field"
```

---

### Task 11: Full verification + HANDOFF refresh

**Files:**
- Modify: `cmstack-ts/HANDOFF.md`, `cmstack-ts/REFACTOR_PLAN.md` (tick §7 #5), `.env.example` (document `CONTACT_RECIPIENT_EMAIL`)

- [ ] **Step 1: Document the env var** — add `CONTACT_RECIPIENT_EMAIL=` to `.env.example` near the SMTP vars with a one-line comment (optional; falls back to `MAIL_FROM`).

- [ ] **Step 2: Full gates**

Run:
```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm vitest run --coverage
```
Expected: all green; coverage ≥80% on services+repos; record real numbers.

- [ ] **Step 3: Rebuild + restart stack + e2e** (per the HANDOFF full-stack recipe; the api needs a rebuild for the new module). Then `pnpm e2e` → 11/11.

- [ ] **Step 4: Live verification**

```bash
# submit (recaptcha disabled locally → passes; honeypot empty)
curl -s -X POST 127.0.0.1:4000/public/contact -H 'Content-Type: application/json' \
  -d '{"name":"Live Test","email":"live@x.test","subject":"Hi","message":"hello from curl"}' -w '\n%{http_code}\n'
# honeypot drop → still 201, no row
curl -s -X POST 127.0.0.1:4000/public/contact -H 'Content-Type: application/json' \
  -d '{"name":"Bot","email":"b@x.test","message":"x","company":"filled"}' -w '\n%{http_code}\n'
# the notification email is printed to the API log by the no-op transport:
grep -A4 "mail:noop" <api-log> | tail -8
# admin inbox SSR (needs a session) — or verify the row via the API log/DB:
```
Expected: real submit → `201` + a `[mail:noop]` log line to the resolved recipient; honeypot submit → `201` but no new row/email; `/[locale]/contact` renders the form.

- [ ] **Step 5: Adversarial self-review (inline, no parallel agents)** — re-read the diff as a skeptic for: honeypot/recaptcha bypass, email-injection via header/subject (only `to` is server-resolved; subject is built, not header-injected), HTML escape in the email body, P2025 mapping, listener fault isolation (a mail throw must not surface — confirm `emit` swallows), recipient fallback precedence, public submit never leaking stored data. Fix findings with a regression test each.

- [ ] **Step 6: Refresh HANDOFF + tick §7 #5** in `REFACTOR_PLAN.md` (`- [x] Contact form …`) and add the §7 #5 block to `HANDOFF.md` (test count, coverage, e2e, live notes, scoped-out items). Update "Next §7 item" to **#6 GA4/GTM**.

- [ ] **Step 7: Final commit**

```bash
git add cmstack-ts/HANDOFF.md cmstack-ts/REFACTOR_PLAN.md cmstack-ts/.env.example
git commit -m "docs: mark Task 1 §7 #5 (contact form) done; refresh HANDOFF"
```

---

## Self-Review (against the spec)

**Spec coverage:** data model (ContactSubmission + contactEmail) → T2; config schemas + recipient resolver → T1; repository → T3; email builder → T4; service (honeypot/recaptcha/persist/emit) + ActionMap → T5; mail listener + recipient resolution → T6; controllers (public throttled + admin) + module + listener registration + CASL `Contact` + SEO default → T7; seed (contactEmail + demo + grant) → T8; public form web → T9; admin inbox + SEO field → T10; observer (`contact.submitted`) → T5/T6/T7; testing + verification → T1–T6 unit, T11 gates/e2e/live; rollback → T2 review. All spec sections map to a task.

**Placeholder scan:** concrete code for config/repo/service/listener/email/controllers (the behaviour-bearing layers). T9/T10 web steps show the form + page + form-post code in full; the inbox/nav steps describe components by mirroring named existing patterns (`seo/entry-crud.tsx`, the menu admin nav threading just done) — established, low-risk conventions, not novel logic.

**Type consistency:** `ContactSubmissionInput`/`AdminContact`/`UpdateContactInput`/`resolveContactRecipient` defined in T1, consumed in T5/T6/T7/T10; `CONTACT_SUBMISSION_REPOSITORY`/`ContactSubmissionRepository`/`ContactSubmissionCreateData` defined in T3, consumed in T5/T7; `contactNotificationEmail` defined in T4, consumed in T6; `ActionMap['contact.submitted']` defined in T5, consumed in T6/T7; `MailService.send({ to, subject, text, html })` matches the existing signature used in T6.
