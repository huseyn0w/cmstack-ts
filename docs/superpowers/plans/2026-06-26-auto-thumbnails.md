# Auto Thumbnails / Image Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On image upload, generate downscaled WebP derivatives (thumb ≤400, medium ≤1024), store them, and record them on `Media.thumbnails` — guarded against decompression bombs.

**Architecture:** A new `ImageProcessor` (sharp-backed) is injected into `MediaService` alongside the existing `StorageDriver`. Upload measures the image header (decompression-bomb guard), saves the original, synchronously and fault-isolatedly generates WebP derivatives, and writes them as a Json column. Delete cleans up the derivatives.

**Tech Stack:** NestJS (API, CommonJS), `sharp`, `image-size`, Prisma/Postgres (Json column), Next.js (admin grid), Zod (`@cmstack-ts/config`), Vitest, Biome.

## Global Constraints

- Reply to the operator in **Russian**; code/comments/docs in **English**.
- Import model + repo types from `@cmstack-ts/db`, shared contracts from `@cmstack-ts/config` (never `@prisma/client` directly, never redefine schemas).
- Migrations are **additive and reversible**; `packages/db` needs `DATABASE_URL` passed explicitly to every prisma command.
- Repos never catch P2002/P2025; services hold logic; controllers thin (no change — reuse the media module).
- **No observer event** (§2.7 — generation is part of the upload, not a separate side effect).
- Preserve the existing upload invariant: a row-create failure rolls back **all** stored files (now original + derivatives).
- Output derivatives are **always WebP**; animated GIF → static first-frame WebP; **PDF → no thumbnails**.
- Decompression-bomb guard: reject `width*height > MEDIA_MAX_MEGAPIXELS*1e6` (env default **40**) before decode; construct `sharp` with `{ limitInputPixels }` at the same cap.
- All gates before commit: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm vitest run --coverage` (≥80%), then live curl/SSR + `pnpm e2e` (11/11).
- No `Co-Authored-By`/Claude trailer in commits.
- **Write-tool gotcha:** strip a stray trailing `</content>` (`perl -0pi -e 's/\n?<\/content>\s*$//' <file>`) + `pnpm format`.

---

### Task 1: Config — thumbnail schema, key helper, sizes, megapixel env

**Files:**
- Modify: `packages/config/src/media.ts`
- Modify: `packages/config/src/env.ts:26`
- Modify: `packages/config/src/index.ts`
- Test: `packages/config/src/media.test.ts` (create if absent)

**Interfaces:**
- Produces: `thumbnailSchema` → `{ label, width, height, url, size }`; `Thumbnail` type; `mediaSchema.thumbnails: Thumbnail[]`; `THUMBNAIL_SIZES` (`readonly { label: string; max: number }[]`); `thumbnailKey(baseKey, label) => string`; env `MEDIA_MAX_MEGAPIXELS: number`.

- [ ] **Step 1: Write the failing test**

Create `packages/config/src/media.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { THUMBNAIL_SIZES, mediaSchema, thumbnailKey, thumbnailSchema } from './media';

describe('thumbnailSchema', () => {
  it('parses a derivative entry', () => {
    const t = thumbnailSchema.parse({
      label: 'thumb',
      width: 400,
      height: 320,
      url: '/uploads/abc-thumb.webp',
      size: 1234,
    });
    expect(t.label).toBe('thumb');
  });
});

describe('mediaSchema.thumbnails', () => {
  it('requires a thumbnails array', () => {
    const base = {
      id: '1', filename: 'f', originalName: 'o', mimeType: 'image/png', size: 1,
      width: 10, height: 10, alt: null, title: null, caption: null, url: '/uploads/f',
      createdAt: '2026-06-26T00:00:00.000Z', updatedAt: '2026-06-26T00:00:00.000Z',
    };
    expect(() => mediaSchema.parse(base)).toThrow();
    expect(mediaSchema.parse({ ...base, thumbnails: [] }).thumbnails).toEqual([]);
  });
});

describe('thumbnailKey', () => {
  it('derives <base>-<label>.webp and strips the source extension', () => {
    expect(thumbnailKey('123-abcd.png', 'thumb')).toBe('123-abcd-thumb.webp');
    expect(thumbnailKey('123-abcd.jpg', 'medium')).toBe('123-abcd-medium.webp');
    expect(thumbnailKey('123-abcd', 'thumb')).toBe('123-abcd-thumb.webp');
  });
});

describe('THUMBNAIL_SIZES', () => {
  it('defines thumb 400 and medium 1024', () => {
    expect(THUMBNAIL_SIZES.map((s) => [s.label, s.max])).toEqual([
      ['thumb', 400],
      ['medium', 1024],
    ]);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm vitest run packages/config/src/media.test.ts`
Expected: FAIL (`thumbnailSchema`/`thumbnailKey`/`THUMBNAIL_SIZES` not exported).

- [ ] **Step 3: Implement in `media.ts`**

Add to `packages/config/src/media.ts`:

```ts
export const thumbnailSchema = z.object({
  label: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  url: z.string(),
  size: z.number().int().nonnegative(),
});
export type Thumbnail = z.infer<typeof thumbnailSchema>;

/** Derivative sizes generated on image upload (max edge, resize-to-fit, no upscale). */
export const THUMBNAIL_SIZES = [
  { label: 'thumb', max: 400 },
  { label: 'medium', max: 1024 },
] as const;

/** Storage key for a derivative: `<base-without-ext>-<label>.webp`. */
export function thumbnailKey(baseKey: string, label: string): string {
  const dot = baseKey.lastIndexOf('.');
  const stem = dot > 0 ? baseKey.slice(0, dot) : baseKey;
  return `${stem}-${label}.webp`;
}
```

Add `thumbnails: z.array(thumbnailSchema)` to `mediaSchema` (after `url`):

```ts
  url: z.string(),
  thumbnails: z.array(thumbnailSchema),
  createdAt: z.string().datetime(),
```

- [ ] **Step 4: Add the env var**

In `packages/config/src/env.ts`, after `MEDIA_MAX_SIZE_MB`:

```ts
  // Reject images above this many megapixels before decoding (decompression-bomb guard).
  MEDIA_MAX_MEGAPIXELS: z.coerce.number().int().positive().max(500).default(40),
```

- [ ] **Step 5: Export from the barrel**

In `packages/config/src/index.ts`, inside the `./media` export block add:

```ts
  thumbnailSchema,
  type Thumbnail,
  THUMBNAIL_SIZES,
  thumbnailKey,
```

- [ ] **Step 6: Run config suite + build, verify pass**

Run: `pnpm vitest run packages/config && pnpm --filter @cmstack-ts/config build`
Expected: PASS, build clean.

- [ ] **Step 7: Commit**

```bash
git add packages/config/src/media.ts packages/config/src/media.test.ts packages/config/src/env.ts packages/config/src/index.ts
git commit -m "feat(config): thumbnail schema, key helper, sizes, megapixel guard env"
```

---

### Task 2: Prisma migration — `Media.thumbnails` Json column

**Files:**
- Modify: `packages/db/prisma/schema.prisma:248-269` (`Media` model)
- Create: `packages/db/prisma/migrations/<ts>_media_thumbnails/migration.sql` (generated)

- [ ] **Step 1: Edit the schema**

In `model Media`, after the `url` field:

```prisma
  /// Generated WebP derivatives: [{ label, width, height, url, size }]. Empty = none.
  thumbnails   Json     @default("[]")
```

- [ ] **Step 2: Generate the migration**

```bash
export DATABASE_URL="postgresql://typress:typress@localhost:5432/typress?schema=public"
pnpm --filter @cmstack-ts/db exec prisma migrate dev --name media_thumbnails
```

Expected: `ALTER TABLE "Media" ADD COLUMN "thumbnails" JSONB NOT NULL DEFAULT '[]'` — purely additive.

- [ ] **Step 3: Regenerate client + build**

Run: `pnpm db:generate && pnpm --filter @cmstack-ts/db build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): additive Media.thumbnails Json column"
```

---

### Task 3: ImageProcessor + SharpImageProcessor

**Files:**
- Modify: `apps/api/package.json` (add `sharp`)
- Create: `apps/api/src/media/image-processor.ts`
- Create: `apps/api/src/media/sharp-image-processor.ts`
- Create: `apps/api/src/media/sharp-image-processor.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  interface GeneratedThumbnail { label: string; width: number; height: number; data: Buffer }
  interface ImageProcessor {
    makeThumbnails(input: Buffer, sizes: readonly { label: string; max: number }[]): Promise<GeneratedThumbnail[]>;
  }
  const IMAGE_PROCESSOR: symbol;
  class SharpImageProcessor implements ImageProcessor // constructor(maxMegapixels: number)
  ```

- [ ] **Step 1: Add the dependency**

Run: `pnpm --filter @cmstack-ts/api add sharp`
Expected: `sharp` in `apps/api/package.json`.

- [ ] **Step 2: Define the interface**

Create `apps/api/src/media/image-processor.ts`:

```ts
export interface GeneratedThumbnail {
  label: string;
  width: number;
  height: number;
  data: Buffer;
}

/** Generates downscaled image derivatives. Framework-free; swappable. */
export interface ImageProcessor {
  /**
   * Produce one WebP derivative per requested size, resize-to-fit (never
   * upscaling). Returns [] for input sharp cannot process.
   */
  makeThumbnails(
    input: Buffer,
    sizes: readonly { label: string; max: number }[],
  ): Promise<GeneratedThumbnail[]>;
}

export const IMAGE_PROCESSOR = Symbol('IMAGE_PROCESSOR');
```

- [ ] **Step 3: Write the failing integration test**

Create `apps/api/src/media/sharp-image-processor.spec.ts`:

```ts
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { SharpImageProcessor } from './sharp-image-processor';

let png: Buffer;
beforeAll(async () => {
  png = await sharp({
    create: { width: 1000, height: 800, channels: 3, background: { r: 200, g: 50, b: 50 } },
  })
    .png()
    .toBuffer();
});

describe('SharpImageProcessor', () => {
  const processor = new SharpImageProcessor(40);
  const sizes = [
    { label: 'thumb', max: 400 },
    { label: 'medium', max: 1024 },
  ] as const;

  it('produces one WebP derivative per size, bounded to the max edge', async () => {
    const out = await processor.makeThumbnails(png, sizes);
    expect(out.map((t) => t.label)).toEqual(['thumb', 'medium']);
    const thumb = out[0];
    expect(Math.max(thumb.width, thumb.height)).toBeLessThanOrEqual(400);
    // WebP magic: bytes 0-3 'RIFF', 8-11 'WEBP'.
    expect(thumb.data.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(thumb.data.subarray(8, 12).toString('latin1')).toBe('WEBP');
  });

  it('does not upscale beyond the source size', async () => {
    const out = await processor.makeThumbnails(png, sizes);
    const medium = out[1];
    // Source is 1000px wide < 1024 max → output stays 1000, not enlarged.
    expect(medium.width).toBe(1000);
  });

  it('returns [] for non-image bytes', async () => {
    const out = await processor.makeThumbnails(Buffer.from('not an image'), sizes);
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 4: Run, verify fail**

Run: `pnpm vitest run apps/api/src/media/sharp-image-processor.spec.ts`
Expected: FAIL (`SharpImageProcessor` not found).

- [ ] **Step 5: Implement the sharp adapter**

Create `apps/api/src/media/sharp-image-processor.ts`:

```ts
import sharp from 'sharp';
import type { GeneratedThumbnail, ImageProcessor } from './image-processor';

export class SharpImageProcessor implements ImageProcessor {
  private readonly limitInputPixels: number;

  constructor(maxMegapixels: number) {
    this.limitInputPixels = maxMegapixels * 1_000_000;
  }

  async makeThumbnails(
    input: Buffer,
    sizes: readonly { label: string; max: number }[],
  ): Promise<GeneratedThumbnail[]> {
    const out: GeneratedThumbnail[] = [];
    for (const size of sizes) {
      try {
        const { data, info } = await sharp(input, { limitInputPixels: this.limitInputPixels })
          .rotate() // honour EXIF orientation
          .resize({ width: size.max, height: size.max, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer({ resolveWithObject: true });
        out.push({ label: size.label, width: info.width, height: info.height, data });
      } catch {
        // Unprocessable input → no derivatives (caller treats as thumbnails: []).
        return [];
      }
    }
    return out;
  }
}
```

- [ ] **Step 6: Run, verify pass**

Run: `pnpm vitest run apps/api/src/media/sharp-image-processor.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/media/image-processor.ts apps/api/src/media/sharp-image-processor.ts apps/api/src/media/sharp-image-processor.spec.ts
git commit -m "feat(api): sharp-backed ImageProcessor for WebP thumbnails"
```

---

### Task 4: MediaService — guard, generation, thumbnails, cleanup; repo + wiring

**Files:**
- Modify: `apps/api/src/media/media.service.ts`
- Modify: `apps/api/src/media/media.service.spec.ts`
- Modify: `apps/api/src/media/media.module.ts` (provide `IMAGE_PROCESSOR`)
- Modify: `packages/db/src/repositories/media.repository.ts` (`MediaCreateData.thumbnails`)

**Interfaces:**
- Consumes: `ImageProcessor`/`IMAGE_PROCESSOR` (Task 3); `THUMBNAIL_SIZES`/`thumbnailKey`/`Thumbnail`/`MEDIA_MAX_MEGAPIXELS` (Task 1); `thumbnails` column (Task 2).
- Produces: `upload` writes `thumbnails`; `remove` deletes derivative keys; `toView` surfaces `thumbnails`.

- [ ] **Step 1: Widen `MediaCreateData` + repo create**

In `packages/db/src/repositories/media.repository.ts`, import `Prisma` and add to `MediaCreateData`:

```ts
import type { Media, Prisma, PrismaClient } from '@prisma/client';
```
```ts
  uploaderId: string;
  thumbnails: Prisma.InputJsonValue;
};
```

(The `create` method already spreads `data`, so no change there. `findById`/list return the full row incl. `thumbnails`.)

- [ ] **Step 2: Write the failing service tests**

In `apps/api/src/media/media.service.spec.ts`, add a fake processor to the existing setup and these tests (match the existing fake-storage/fake-repo variable names in the file — read it first):

```ts
// Fake processor used across the new tests:
const processor = { makeThumbnails: vi.fn() };
// ...construct: new MediaService(mediaRepo, storage, processor as unknown as ImageProcessor)

it('generates derivatives, stores them, and records the thumbnails JSON', async () => {
  processor.makeThumbnails.mockResolvedValue([
    { label: 'thumb', width: 400, height: 320, data: Buffer.from('a') },
    { label: 'medium', width: 1000, height: 800, data: Buffer.from('bb') },
  ]);
  storage.save.mockResolvedValue(undefined);
  mediaRepo.create.mockImplementation((d) => Promise.resolve({ id: 'm1', ...d, alt: null, title: null, caption: null, createdAt: new Date(), updatedAt: new Date() }));
  const png = await makeTinyPng(); // 1000x800 helper, or a stubbed image-size — see below
  const res = await service.upload(
    { originalname: 'a.png', mimetype: 'image/png', size: png.length, buffer: png },
    'user-1',
  );
  // original + 2 derivatives saved
  expect(storage.save).toHaveBeenCalledTimes(3);
  expect(res.thumbnails).toHaveLength(2);
  expect(res.thumbnails[0]).toMatchObject({ label: 'thumb', width: 400, url: expect.stringContaining('-thumb.webp') });
});

it('rejects an image above the megapixel guard before saving', async () => {
  const huge = await sharp({ create: { width: 8000, height: 6000, channels: 3, background: '#fff' } }).png().toBuffer();
  await expect(
    service.upload({ originalname: 'h.png', mimetype: 'image/png', size: huge.length, buffer: huge }, 'u'),
  ).rejects.toThrow(); // 48 MP > 40 MP default
  expect(storage.save).not.toHaveBeenCalled();
});

it('still uploads with thumbnails: [] when generation fails (fault-isolated)', async () => {
  processor.makeThumbnails.mockRejectedValue(new Error('boom'));
  storage.save.mockResolvedValue(undefined);
  mediaRepo.create.mockImplementation((d) => Promise.resolve({ id: 'm2', ...d, alt: null, title: null, caption: null, createdAt: new Date(), updatedAt: new Date() }));
  const png = await makeTinyPng();
  const res = await service.upload({ originalname: 'a.png', mimetype: 'image/png', size: png.length, buffer: png }, 'u');
  expect(res.thumbnails).toEqual([]);
  expect(storage.save).toHaveBeenCalledTimes(1); // only the original
});

it('remove deletes the original and every derivative key', async () => {
  mediaRepo.findFilename.mockResolvedValue({
    filename: 'k.png',
    thumbnails: [{ label: 'thumb', width: 1, height: 1, url: '/uploads/k-thumb.webp', size: 1 }],
  });
  mediaRepo.hardDelete.mockResolvedValue(undefined);
  storage.delete.mockResolvedValue(undefined);
  await service.remove('m1');
  expect(storage.delete).toHaveBeenCalledWith('k.png');
  expect(storage.delete).toHaveBeenCalledWith('k-thumb.webp');
});
```

Add a small helper near the top of the spec (so generation tests have a real image whose header `image-size` can read):

```ts
import sharp from 'sharp';
async function makeTinyPng(): Promise<Buffer> {
  return sharp({ create: { width: 1000, height: 800, channels: 3, background: '#abc' } }).png().toBuffer();
}
```

- [ ] **Step 3: Run, verify fail**

Run: `pnpm vitest run apps/api/src/media/media.service.spec.ts`
Expected: FAIL (constructor arity / `thumbnails` undefined / guard not enforced).

- [ ] **Step 4: Implement the service**

In `apps/api/src/media/media.service.ts`:

Add imports:

```ts
import { THUMBNAIL_SIZES, type Thumbnail, parseEnv, thumbnailKey } from '@cmstack-ts/config';
import { IMAGE_PROCESSOR, type ImageProcessor } from './image-processor';
```

Add the constructor dependency:

```ts
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly media: MediaRepository,
    @Inject(STORAGE) private readonly storage: StorageDriver,
    @Inject(IMAGE_PROCESSOR) private readonly processor: ImageProcessor,
  ) {}
```

Add `thumbnails` to the `MediaRow` type and `toView`:

```ts
// in MediaRow type:
  url: string;
  thumbnails: unknown;
  createdAt: Date;
```
```ts
// in toView return:
      url: media.url,
      thumbnails: (media.thumbnails as Thumbnail[]) ?? [],
      createdAt: media.createdAt.toISOString(),
```

Replace `upload` with the generation flow:

```ts
  async upload(file: UploadFile, uploaderId: string): Promise<Media> {
    const dimensions = this.validateAndMeasure(file);

    const key = `${Date.now()}-${randomBytes(8).toString('hex')}${extensionForMime(file.mimetype)}`;
    await this.storage.save(key, file.buffer);

    const savedThumbKeys: string[] = [];
    let thumbnails: Thumbnail[] = [];
    if (file.mimetype.startsWith('image/')) {
      try {
        const generated = await this.processor.makeThumbnails(file.buffer, THUMBNAIL_SIZES);
        for (const t of generated) {
          const thumbKey = thumbnailKey(key, t.label);
          await this.storage.save(thumbKey, t.data);
          savedThumbKeys.push(thumbKey);
          thumbnails.push({
            label: t.label,
            width: t.width,
            height: t.height,
            url: `/uploads/${thumbKey}`,
            size: t.data.length,
          });
        }
      } catch {
        // Fault-isolated: keep the original; drop any partial derivatives.
        await Promise.all(savedThumbKeys.map((k) => this.storage.delete(k)));
        savedThumbKeys.length = 0;
        thumbnails = [];
      }
    }

    try {
      const media = await this.media.create({
        filename: key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        url: `/uploads/${key}`,
        uploaderId,
        thumbnails: thumbnails as unknown as Parameters<MediaRepository['create']>[0]['thumbnails'],
      });
      return this.toView(media);
    } catch (error) {
      await this.storage.delete(key);
      await Promise.all(savedThumbKeys.map((k) => this.storage.delete(k)));
      throw error;
    }
  }
```

Enforce the megapixel guard in `validateAndMeasure` (image branch):

```ts
    if (file.mimetype.startsWith('image/')) {
      try {
        const { width, height } = imageSize(file.buffer);
        if (!width || !height) throw new Error('no dimensions');
        const maxPixels = parseEnv().MEDIA_MAX_MEGAPIXELS * 1_000_000;
        if (width * height > maxPixels) {
          throw new BadRequestException('Image is too large to process.');
        }
        return { width, height };
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Uploaded file is not a valid image.');
      }
    }
```

Update `remove` to delete derivatives (and widen `findFilename`):

```ts
  async remove(id: string): Promise<void> {
    const media = await this.media.findFilename(id);
    if (!media) throw new NotFoundException('Media not found.');
    await this.storage.delete(media.filename);
    for (const t of (media.thumbnails as Thumbnail[] | null) ?? []) {
      // Derive the storage key from the public url (/uploads/<key>).
      await this.storage.delete(t.url.replace(/^\/uploads\//, ''));
    }
    await this.media.hardDelete(id);
  }
```

- [ ] **Step 5: Widen `findFilename` to return thumbnails**

In `packages/db/src/repositories/media.repository.ts`, change the `findFilename` contract + impl to also select `thumbnails`:

```ts
  findFilename(id: string): Promise<{ filename: string; thumbnails: unknown } | null>;
```
```ts
  findFilename(id: string): Promise<{ filename: string; thumbnails: unknown } | null> {
    return this.prisma.media.findUnique({ where: { id }, select: { filename: true, thumbnails: true } });
  }
```

- [ ] **Step 6: Wire `IMAGE_PROCESSOR` in the module**

In `apps/api/src/media/media.module.ts`, add the provider:

```ts
import { parseEnv } from '@cmstack-ts/config';
import { IMAGE_PROCESSOR } from './image-processor';
import { SharpImageProcessor } from './sharp-image-processor';
// ...
  providers: [
    MediaService,
    provideRepository(MEDIA_REPOSITORY, PrismaMediaRepository),
    { provide: IMAGE_PROCESSOR, useFactory: () => new SharpImageProcessor(parseEnv().MEDIA_MAX_MEGAPIXELS) },
  ],
```

- [ ] **Step 7: Run service + repo tests, verify pass**

Run: `pnpm vitest run apps/api/src/media packages/db/src/repositories`
Expected: PASS.

- [ ] **Step 8: Typecheck API + db**

Run: `cd apps/api && pnpm exec tsc -p tsconfig.json --noEmit; cd ../.. && pnpm --filter @cmstack-ts/db build`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/media/media.service.ts apps/api/src/media/media.service.spec.ts apps/api/src/media/media.module.ts packages/db/src/repositories/media.repository.ts
git commit -m "feat(api): generate + store WebP thumbnails on upload with bomb guard"
```

---

### Task 5: Web — Media fixtures + admin grid uses the thumb variant

**Files:**
- Modify: `apps/web/app/admin/media/media-grid.tsx`
- Modify: any web `Media` fixtures/FALLBACKs missing `thumbnails` (search below)

- [ ] **Step 1: Find Media fixtures missing the field**

Run: `cd apps/web && grep -rln "mimeType:" app lib | grep -v node_modules`
For each literal of type `Media`, add `thumbnails: []`. (The typecheck in Step 3 will list any that are missing.)

- [ ] **Step 2: Use the thumb variant in the grid**

In `apps/web/app/admin/media/media-grid.tsx`, where the grid `<img src={absUrl}>` is built (around line 45/58), prefer the `thumb` derivative:

```tsx
  const thumb = item.thumbnails.find((t) => t.label === 'thumb');
  const absUrl = absoluteUrl(thumb?.url ?? item.url);
```

(Leave the detail/preview `<img>` on the full `item.url`.)

- [ ] **Step 3: Typecheck web**

Run: `pnpm --filter @cmstack-ts/web exec tsc --noEmit`
Expected: clean (add `thumbnails: []` to any fixture the compiler flags, then re-run).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/admin/media/media-grid.tsx apps/web
git commit -m "feat(web): admin media grid renders the thumb derivative"
```

---

### Task 6: Full gates, live verification, adversarial review, HANDOFF

**Files:**
- Modify: `cmstack-ts/HANDOFF.md`, `cmstack-ts/REFACTOR_PLAN.md` (§7 #7 tick), `.env.example` (document `MEDIA_MAX_MEGAPIXELS`)

- [ ] **Step 1: Document the env var**

In `.env.example`, near `MEDIA_MAX_SIZE_MB`, add:

```
# Reject images above this many megapixels before processing (decompression-bomb guard).
MEDIA_MAX_MEGAPIXELS=40
```

- [ ] **Step 2: Run the full unit gates**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm vitest run --coverage   # ≥80% must hold
```

Expected: all green; record real counts.

- [ ] **Step 3: Live stack verification (HANDOFF recipe)**

Bring the stack up, then upload a real image via the API and confirm derivatives:

```bash
# Obtain a bearer token (login as the seeded admin), then:
curl -s -X POST localhost:4000/media -H "Authorization: Bearer $TOKEN" \
  -F "file=@some-large.jpg" | jq '{url, thumbnails}'
# Expect thumbnails: [{label:'thumb',...}, {label:'medium',...}]
ls uploads/ | grep -E -- '-(thumb|medium)\.webp'   # derivative files exist
curl -s -o /dev/null -w "%{http_code}\n" "localhost:4000/uploads/$(ls uploads | grep -- -thumb.webp | head -1)"  # 200
# Decompression-bomb guard: a >40MP image is rejected 400.
# Admin grid: open /admin/media → thumbnails render.
```

Then `pnpm e2e` → 11/11.

- [ ] **Step 4: Adversarial self-review (inline, no parallel agents)**

Check: guard rejects >40MP before any storage/decoder call; `limitInputPixels` set on sharp; generation failure never fails the upload nor orphans files; row-create rollback removes original + all derivatives; `remove` deletes all derivative keys; derivative key derivation is collision-safe (`<base>-<label>.webp` off the unique original key); WebP output only (no SVG/polyglot served as html — extension still MIME-derived); PDF skipped; no observer event. Fix any finding with a regression test.

- [ ] **Step 5: Update HANDOFF + tick §7 #7**

Add a "§7 #7 — DONE" block to `HANDOFF.md` (mirroring prior entries: migration name, deps, test counts, live results, scoped-out items) and tick #7 in `REFACTOR_PLAN.md` §7. Update the continuation prompt's next item to #8 (dashboard translation tab-strip UI).

- [ ] **Step 6: Final commit**

```bash
git add cmstack-ts/HANDOFF.md cmstack-ts/REFACTOR_PLAN.md .env.example
git commit -m "feat: auto thumbnails / image processing (Task 1 §7 #7)"
```

---

## Self-Review

**Spec coverage:**
- sharp dep + sync fault-isolated generation → Tasks 3, 4. ✓
- Decompression-bomb guard (megapixel pre-check + `limitInputPixels`) → Tasks 1 (env), 3 (sharp), 4 (service). ✓
- thumb 400 + medium 1024, WebP, no upscale → Tasks 1 (`THUMBNAIL_SIZES`), 3 (resize fit/withoutEnlargement, `.webp()`). ✓
- Json column + schema + key helper → Tasks 1, 2. ✓
- Storage of derivatives + delete cleanup + rollback → Task 4. ✓
- Admin grid surface → Task 5. ✓
- Gates + live + adversarial + HANDOFF + env doc → Task 6. ✓
- Out-of-scope (PDF, backfill, srcset, crop) → documented in spec; nothing to build. ✓

**Placeholder scan:** Task 5 Step 1 intentionally finds fixtures by grep then relies on the typecheck to enumerate them (the action — add `thumbnails: []` — is concrete). All logic steps carry full code. No TBD/TODO.

**Type consistency:** `thumbnailSchema`/`Thumbnail`, `THUMBNAIL_SIZES`, `thumbnailKey`, `ImageProcessor`/`IMAGE_PROCESSOR`/`GeneratedThumbnail`, `makeThumbnails`, `MEDIA_MAX_MEGAPIXELS`, and `thumbnails` (column + view field) are spelled identically across Tasks 1–5. The derivative key format `<base>-<label>.webp` matches between `thumbnailKey` (Task 1), the service save (Task 4), and the `remove` url→key derivation (Task 4).
