# §7 #7 — Auto thumbnails / image processing — Design

**Date:** 2026-06-26 · **Status:** approved · **Feature register:** `REFACTOR_PLAN.md` §7 #7

## Goal

On image upload, automatically generate downscaled WebP derivatives ("thumbnails"),
store them alongside the original, and record them on the `Media` row — guarded against
decompression bombs. Two derivatives: **thumb (≤400px)** and **medium (≤1024px)**,
resize-to-fit (preserve aspect ratio, never upscale).

## Decisions

- **Library:** `sharp` (new dependency in `apps/api`) — the de-facto Node image processor.
  Justified by the feature, not speculative.
- **Timing:** synchronous during upload and **fault-isolated** — if generation fails
  (corrupt bytes that passed header validation, OOM, unsupported), the original still
  uploads with `thumbnails = []` and any partial derivative files are cleaned up. There is
  no job-queue infrastructure in the stack; synchronous is simpler and sufficient.
- **Output format:** always **WebP** (smaller, broadly supported). Animated GIF → a static
  WebP from the first frame. **PDF → no thumbnails.**
- **Storage of derivatives:** a **Json column** `thumbnails` on `Media`
  (`[{label, width, height, url, size}]`), not a separate table — a fixed small set tied to
  one Media, edited as a unit; consistent with the §7 #6 `customVerificationTags` precedent.
  Files live in the same `StorageDriver` under derived keys (`<base>-<label>.webp`).
- **No observer event** (§2.7): generation is part of the upload, not a separate side effect.

## Decompression-bomb guard (required by REFACTOR_PLAN §7 #7)

`image-size` already reads dimensions from the header **without decoding pixels**. Before any
decode:

- If `width * height > MEDIA_MAX_MEGAPIXELS * 1_000_000` (env, default **40** MP) → throw
  `BadRequestException('Image is too large to process.')`.
- Defense-in-depth: `sharp` is constructed with `{ limitInputPixels: <same cap> }` so even a
  header that lies cannot drive an unbounded decode.

## Data model (one additive, reversible migration)

`Media` gains `thumbnails Json @default("[]")` — an array of
`{ label: string; width: number; height: number; url: string; size: number }`.

## Contracts (`@cmstack-ts/config`, `media.ts`)

- `thumbnailSchema = { label, width, height, url, size }` (label a short slug, width/height/
  size positive ints, url a string).
- Add `thumbnails: z.array(thumbnailSchema)` to `mediaSchema` (**required** — the API always
  emits it, like the §7 #6 verification fields; the web FALLBACK/parse must include it).
- Pure helper `thumbnailKey(baseKey: string, label: string): string` — derive
  `<baseKey-without-ext>-<label>.webp` (unit-tested).
- A shared `THUMBNAIL_SIZES` constant: `[{ label: 'thumb', max: 400 }, { label: 'medium', max: 1024 }]`.

## API

- **New unit:** `ImageProcessor` interface + `IMAGE_PROCESSOR` token + `SharpImageProcessor`
  (wraps `sharp`), bound in `StorageModule` (or the media module) via a provider. Interface:
  ```ts
  interface GeneratedThumbnail { label: string; width: number; height: number; data: Buffer }
  interface ImageProcessor {
    // Returns one entry per size that applies (skips sizes larger than the source —
    // no upscale). May return [] for non-raster or unprocessable input.
    makeThumbnails(input: Buffer, sizes: readonly { label: string; max: number }[]): Promise<GeneratedThumbnail[]>;
  }
  ```
- **`MediaService.upload`** (extends the existing flow, preserving the rollback invariant):
  1. `validateAndMeasure(file)` — now also enforces the megapixel guard.
  2. `storage.save(key, file.buffer)` (original).
  3. For images only: `const thumbs = await this.processor.makeThumbnails(file.buffer, THUMBNAIL_SIZES)`
     inside a try/catch — on throw, log and continue with `thumbs = []`. For each generated
     thumb, `storage.save(thumbnailKey(key, t.label), t.data)`; collect
     `{ label, width, height, url: '/uploads/' + thumbKey, size: data.length }`. Track saved
     thumb keys so they can be rolled back.
  4. `media.create({ ..., thumbnails })`.
  5. On row-create failure: delete the original **and** every saved thumb, then rethrow.
- **`MediaService.remove`**: after loading the row, delete the original and every
  `thumbnails[].url`-derived key from storage (extend `findFilename` to also return
  `thumbnails`, or load the full row).
- `toView` surfaces `thumbnails` (cast the Json like §7 #6). `MediaCreateData` gains
  `thumbnails: Prisma.InputJsonValue`.
- No CASL/route changes; same `Media` subject.

## Web

- The admin **media library** renders the `thumb` (≤400) variant when present (faster grid),
  falling back to the original `url` otherwise. Public responsive `<img srcset>` is **future**
  (out of scope for #7).
- `Media` type now carries `thumbnails`; any web `Media` fixtures/FALLBACKs add `thumbnails: []`.

## Seed

No change required (seed media, if any, can omit thumbnails → `[]`). New uploads through the
running stack exercise generation for live verification.

## Testing (TDD by layer)

- **config:** `thumbnailSchema` parse; `thumbnailKey` derives `<base>-<label>.webp` and strips
  the original extension.
- **service (fake processor + fake storage):**
  - megapixel guard rejects an over-cap image before any storage/processor call;
  - a successful upload saves N derivative files and writes the `thumbnails` JSON;
  - a processor that throws still yields a successful upload with `thumbnails: []` (and no
    orphaned thumb files);
  - `remove` deletes the original and every derivative key;
  - the existing rollback test still holds (row-create failure deletes original + thumbs).
- **SharpImageProcessor (integration):** feed a tiny real PNG buffer → returns two WebP
  derivatives at the expected bounded sizes, and does **not** upscale a source smaller than a
  requested max. Coverage gate ≥80% must hold.

## Out of scope (logged, not silent)

PDF thumbnails (needs a heavy PDF renderer); backfill of pre-existing media (only new uploads
get derivatives — a future one-off script); public `<img srcset>`/responsive delivery; crop /
focal-point / on-demand resize endpoints.
