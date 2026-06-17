# CLAUDE.md

This file guides Claude Code (CLI / VSCode extension) when working in this repository.

## Project

Typress is an open-source, WordPress-style CMS built on TypeScript. Goal: same core
capabilities as WordPress, but lighter, faster, SEO-first, and easy to read, understand,
and extend. It is a commercial/open project that will be demoed publicly on YouTube,
Product Hunt, and Slack, so code quality, security, and a clean demo matter.

Reference implementations by the same author (study for feature parity, not code style):

- Laravel: https://github.com/huseyn0w/Laravella-CMS

**Status:** Phases 0–3 shipped. Phase 0: pnpm monorepo, Docker compose (web/api/db),
Prisma + Postgres, Biome, Vitest, Playwright, CI. Phase 1 (Accounts): User/Role/Permission
models, Argon2id passwords, JWT auth, CASL authorization (PoliciesGuard), Auth.js v5 on
web (credentials + optional Google/GitHub) consuming the API. Phase 2 (Content): Post/
Page/Category/Tag/Revision models, content API with server-side HTML sanitization, slug
generation, draft/publish, soft-delete, revisions, CASL-gated authoring + public read
endpoints, and server-rendered `/blog`. Phase 3 (Media): upload API with a swappable
storage adapter, content-type validation, image dimensions, per-asset metadata, CASL
gating, and static serving at `/uploads`. Next: Phase 4 (Admin UI). The full phased
roadmap and feature mapping live in [README.md](README.md).

## Auth & authorization (Phase 1)

- The **API is the identity source of truth**: it owns User/Role/Permission, hashes
  passwords (Argon2id, `@node-rs/argon2`), and issues HS256 JWTs signed with `AUTH_SECRET`.
- **Web (Auth.js v5)** is the session/social layer: a Credentials provider calls the API
  `/auth/login`; Google/GitHub are enabled only when their env vars are set; the API
  access token rides inside the Auth.js JWT session and is used for SSR calls to the API.
- **Authorization is CASL on the API.** Permissions are `(action, subject)` rows mapped
  1:1 to CASL rules; `manage`/`all` are wildcards. Gate routes with
  `@UseGuards(JwtAuthGuard, PoliciesGuard)` + `@CheckPolicies((a) => a.can(...))`.
  JwtAuthGuard must precede PoliciesGuard. Validate every mutation body with
  `ZodValidationPipe(<sharedSchema>)`.
- Shared request/response shapes live in `@typress/config` (`registerSchema`, `loginSchema`,
  `oauthSchema`, `publicUserSchema`, …) — import them on both sides; never redefine.
- Secrets: `AUTH_SECRET` (shared web↔api), `INTERNAL_API_SECRET` (guards `/auth/oauth`,
  the server-to-server upsert), `WEB_ORIGIN` (CORS). All required; see `.env.example`.
- Known limitation (tracked): GitHub OAuth email-link can be an account-takeover vector
  for unverified provider emails — fetch verified emails before enabling GitHub in prod.

## Content (Phase 2)

- Models: `Post`, `Page`, `Category` (self-referential tree), `Tag`, `Revision`,
  `ContentStatus` enum. Posts have categories/tags (m2m); posts & pages have soft-delete
  (`deletedAt`) and revision history.
- The `content` NestJS module: one service+controller per resource, plus a
  `PublicContentController` exposing published, non-trashed content at `/public/posts`,
  `/public/posts/:slug`, `/public/pages/:slug`. Authoring routes are CASL-gated
  (`@CheckPolicies((a) => a.can('<action>', 'Post'|'Page'|'Category'|'Tag'))`).
- **All rich-text `content` is sanitized server-side via `HtmlSanitizerService`
  (sanitize-html) on every create/update** — the only trusted writer is the seed. The web
  renders stored content with `dangerouslySetInnerHTML`, relying on that guarantee.
- Slugs are auto-generated from the title (`slugify`) and de-duplicated; a P2002 race
  returns 409. Revisions snapshot scalar fields (not taxonomy) of the prior state before
  each update. `publishedAt` is stamped on first publish and preserved thereafter.
- Editor role manages all content; Member has no content permissions. Tiptap editor UI
  is deferred to the admin panel (Phase 4); i18n/SEO-meta fields to Phase 7.

## Media (Phase 3)

- `Media` model + a swappable storage abstraction: code depends on the `StorageDriver`
  interface (`STORAGE` token); `LocalStorageService` writes to `UPLOAD_DIR` today, an S3
  driver is a one-line provider swap in `StorageModule`.
- Upload: `POST /media` (multipart, CASL `create Media`). Size capped by `MEDIA_MAX_SIZE_MB`
  (multer limit + validator). Allowed types: jpeg/png/gif/webp/pdf (`ALLOWED_MEDIA_MIME_TYPES`;
  **SVG excluded**). The bytes are re-validated (image-size for images, `%PDF-` magic for
  pdf), not just the client MIME. **The stored file's extension is derived from the
  validated MIME (`extensionForMime`), never the upload filename** — this prevents a
  polyglot being served as `text/html` (stored XSS). Files served at `/uploads/<key>` with
  `X-Content-Type-Options: nosniff`.
- Storage keys are reduced to a basename (no path traversal). Image width/height are
  stored; alt/title/caption are editable via `PATCH /media/:id`.
- Prod: nginx must forward `/uploads/*` to the API process (or serve the `uploads` volume
  directly, in which case drop `useStaticAssets`).

## Stack (locked decisions — deviate only with a stated reason)

- TypeScript everywhere. Monorepo with **pnpm workspaces** (Turborepo deferred until
  build/CI time warrants it; it layers on top with no migration cost).
  - apps/web: Next.js (App Router) — SSR/SSG/ISR, public site + admin UI. ESM, its own
    build pipeline.
  - apps/api: NestJS — REST/RPC API, modules mirror feature areas. **CommonJS** (cleanest
    for Nest + tsc build and `emitDecoratorMetadata` DI).
  - apps/mcp: MCP server (TypeScript SDK) for AI clients. **ESM** (the SDK is ESM-only).
  - packages/db: Prisma schema + migrations. packages/config: shared zod/env/types.
    Both are **CommonJS**, compile to `dist`, and are consumed from `dist` by the apps;
    Vitest resolves them from `src` via aliases (see vitest.config.ts) so unit tests need
    no prior build.
- Database: PostgreSQL (default). Keep all access through Prisma and DB-agnostic so
  MySQL works for shared hosting.
- Auth + social login: **Auth.js (NextAuth v5)** with the Prisma adapter — handles
  authN + sessions + social on apps/web. Authorization: **CASL** on apps/api (every
  mutation policy-checked). (Lucia was considered and rejected: CASL already owns
  authorization, so Auth.js's batteries-included social providers win.)
- Validation: Zod (forms, API boundaries, env). Rich text: Tiptap (sanitized).
- UI: Tailwind CSS + shadcn/ui + Framer Motion (restrained animation only).
- i18n / multilingual: next-intl + translated fields in Prisma (hreflang).
- Spam: reCAPTCHA v3 + rate limiting. Search: Postgres full-text first.
- Tests: Vitest (unit/integration) + Playwright (e2e). Lint/format: Biome.
- Local infra: Docker + docker compose. Prod: Node on a VPS (Docker or PM2) behind
  nginx; a separate guide for shared hosting (Hostinger / Passenger / cPanel).

## Architecture conventions

- NestJS modules = bounded concerns (accounts, content, media, themes, plugins, seo,
  comments, search, settings). One module = one responsibility.
- Thin controllers; logic in services. Add abstractions only where they remove real
  duplication — not speculatively.
- Themes: swappable template/component sets resolved at runtime. Plugins: extension
  points via a typed hook/event registry, not arbitrary code injection.
- SEO/GEO is first-class: Open Graph + JSON-LD via Next metadata, sitemap.ts, robots.ts,
  hreflang. Public pages render server-side for indexability.
- Types are the contract: share Zod schemas/types across web and api; no `any`.

## Commands (keep this section updated as the project grows)

- Install: `pnpm install` (Node ≥22; pnpm via `corepack enable`).
- Dev up (full stack in Docker): `docker compose up` → web :3000, api :4000, db :5432.
- Dev servers (local, no Docker): `pnpm dev` (runs all apps + package watchers).
- DB: generate client `pnpm db:generate`; apply migrations `pnpm db:migrate`
  (dev migration: `pnpm --filter @typress/db migrate:dev`); seed demo `pnpm db:seed`.
- Tests: `pnpm test` (single: `pnpm vitest run <path> -t "name"`). E2E: `pnpm e2e`.
- Lint/format: `pnpm lint` (check) / `pnpm format` (write). Typecheck: `pnpm typecheck`.
- Build: `pnpm build` (topological: packages → apps).

Notes:
- Biome needs `javascript.parser.unsafeParameterDecoratorsEnabled: true` for NestJS
  param decorators (`@Body`, `@Inject`, …), and `style/useImportType` is off because
  Nest DI needs runtime (value) imports for injected types — see biome.json.
- `pnpm typecheck` builds `packages/*` first so apps can resolve them from `dist`.

## Working rules

- Run tests and Biome after every change; a change is not done until both pass.
- Only make changes directly requested or clearly necessary. Do not add extra packages,
  abstractions, or configurability that was not asked for.
- Never commit secrets; all config via environment variables (.env, with .env.example).
- Keep README.md and this file current when commands, stack, or structure change.
- Communicate with the user in English.
