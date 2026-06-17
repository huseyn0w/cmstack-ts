# Typress

A WordPress-style CMS built entirely in TypeScript — lighter, faster, SEO-first, and
easy to read, understand, and extend.

> **Status:** Phase 0 (Foundation) is complete. The monorepo, Dockerized dev stack,
> database, and the full test/lint/CI toolchain are in place. Feature phases follow the
> roadmap below.

## Stack

| Area | Choice |
| --- | --- |
| Monorepo | pnpm workspaces |
| Web | Next.js (App Router) — `apps/web` |
| API | NestJS — `apps/api` |
| AI connector | MCP server — `apps/mcp` |
| Database | PostgreSQL via Prisma — `packages/db` |
| Shared types/env | Zod — `packages/config` |
| Auth | Auth.js (NextAuth v5) + CASL authorization |
| Validation | Zod | Rich text | Tiptap |
| Tests | Vitest (unit/integration) + Playwright (e2e) |
| Lint/format | Biome |

## Requirements

- Node.js ≥ 22 — `corepack enable` (provides pnpm)
- Docker + Docker Compose (for the one-command dev stack)

## Quick start (Docker — the demo path)

```bash
cp .env.example .env       # adjust if needed
docker compose up --build  # web :3000, api :4000, postgres :5432
pnpm db:seed               # optional: writes a HealthCheck row to prove DB round-trip
```

Then open:

- http://localhost:3000 — the site
- http://localhost:3000/health — system status (renders API + database health, SSR)
- http://localhost:4000/health — API liveness JSON
- http://localhost:4000/health/ready — API readiness (database probe) JSON

## Local development (without Docker)

```bash
corepack enable
pnpm install
pnpm db:generate                       # generate the Prisma client
# start Postgres however you like, then point DATABASE_URL at it in .env
pnpm --filter @typress/db migrate:dev  # apply migrations
pnpm dev                               # runs web, api, mcp + package watchers
```

## Authentication & roles (Phase 1)

The **API is the source of truth for identity** (User/Role/Permission, Argon2id password
hashing, HS256 JWTs). The **web app uses Auth.js v5** as the session/social layer: a
Credentials provider calls the API, and the API access token is carried in the Auth.js
session for server-side calls. Authorization is enforced on the API with **CASL** —
permissions are `(action, subject)` pairs; routes are gated with a `PoliciesGuard`.

Seeded roles: **Administrator** (`manage all`), **Editor** (`read Admin`, `manage User`),
**Member** (default for sign-ups, no admin access). After `pnpm db:seed` you can sign in
with the seeded admin:

```
email:    admin@typress.local
password: admin12345         # local dev only — set SEED_ADMIN_PASSWORD and change in prod
```

Try it: visit `/signup` to create a Member account → `/account` shows your role; the
seeded admin can reach the role-gated `GET /api/admin/overview`, a Member gets `403`.

**Social login (optional):** set `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` and/or
`AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET` to enable those providers (callback URL
`/<origin>/api/auth/callback/<provider>`). Leave them blank to disable — the buttons
simply won't appear.

## Content (Phase 2)

Posts, pages, categories (hierarchical), and tags, with **revisions**, **soft-delete**,
and draft/publish status. All rich-text HTML is **sanitized server-side** on write
(sanitize-html), so stored content is safe to render. Authoring endpoints are CASL-gated
(the **Editor** role manages all content); public, server-rendered reads return only
published content.

After `pnpm db:seed`, the public blog has sample posts:

- `/blog` — published post index (SSR)
- `/blog/<slug>` — a post (e.g. `/blog/introducing-typress`)

Authoring API (Bearer token from login; admin/editor only): `POST/PATCH/DELETE /posts`,
`/pages`, `/categories`, `/tags`; `POST /posts/:id/restore`; `GET /posts/:id/revisions`.
Public read API: `GET /public/posts`, `/public/posts/:slug`, `/public/pages/:slug`.

> The Tiptap editor UI ships with the admin panel (Phase 4); Phase 2 delivers the content
> API, data model, and the sanitization pipeline the editor relies on.

## Project layout

```
apps/
  web/      Next.js App Router — public site + admin (CommonJS-free, ESM via Next)
  api/      NestJS REST API (CommonJS)
  mcp/      MCP server for AI clients (ESM)
packages/
  config/   Shared Zod schemas: env validation + API contracts (CommonJS → dist)
  db/       Prisma schema, client singleton, migrations, seed (CommonJS → dist)
```

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Run all apps + package watchers |
| `pnpm build` | Build everything (packages → apps, topological) |
| `pnpm test` | Vitest unit/integration tests |
| `pnpm e2e` | Playwright end-to-end tests |
| `pnpm lint` / `pnpm format` | Biome check / write |
| `pnpm typecheck` | Type-check every package |
| `pnpm db:generate` / `db:migrate` / `db:seed` | Prisma client / migrations / seed |

## Roadmap

Small, shippable phases. Each ends with Vitest + Playwright green, Biome clean, a
fresh-context review, observable behavior in the running app, and updated docs.

| Phase | Name | Ships |
| --- | --- | --- |
| 0 ✅ | Foundation | Monorepo, Docker compose, Prisma + Postgres, Biome, Vitest, Playwright, CI |
| 1 ✅ | Accounts | Users, roles, granular permissions (CASL), Argon2id + JWT, Auth.js + social login |
| 2 ✅ | Content core | Posts, pages, categories, tags, revisions, soft-delete; server-side HTML sanitization; public `/blog` |
| 3 | Media | Media library + uploads (with alt/title metadata) |
| 4 | Admin UI | Next.js admin panel (own editorial design) |
| 5 | Theme system | Swappable, runtime-resolved template/component sets |
| 6 | Plugin system | Typed hook/event registry |
| 7 | SEO/GEO + i18n | OG + JSON-LD, sitemap.ts, robots.ts, llms.txt, hreflang, next-intl; **admin-editable GEO content (CRUD) so AI assistants recommend your services** |
| 8 | Comments, search, spam | Threaded comments, Postgres FTS, reCAPTCHA v3 + rate limiting |
| 9 | Public site | Server-rendered editorial frontend, profiles, likes |
| 10 | AI integration | MCP server with scoped, validated, authenticated tools |
| 11 | Deploy + demo | VPS guide (Docker/PM2 + nginx) + shared-hosting guide, seed data |

### Feature mapping (reference → Typress)

The WordPress-derived feature set was extracted from the author's Laravel CMS
([Laravella-CMS](https://github.com/huseyn0w/Laravella-CMS)) and mapped to this stack:
content types, users/roles/permissions, media, comments, search, menus, settings,
multilingual, SEO/GEO (incl. `llms.txt`), spam protection, and social auth. Typress goes
beyond the reference with an explicit **theme system**, a typed **plugin/hook registry**,
a **server-rendered** public site for indexability, content **revisions**, per-asset media
metadata, and an **MCP server** for AI-driven management.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
