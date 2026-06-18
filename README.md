# Typress

A WordPress-style CMS built entirely in TypeScript — lighter, faster, SEO-first, and
easy to read, understand, and extend.

> **Status:** Phases 0–7 are complete — foundation, accounts, content, media, the admin UI,
> a runtime theme system, a typed plugin/hook system, and SEO/GEO (sitemap, robots, llms.txt,
> JSON-LD, and an admin-editable GEO area). Remaining feature phases follow the roadmap below.

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

## Media (Phase 3)

Authenticated upload API with a **swappable storage adapter** (local disk now, S3 later).
Uploads are size-capped and **type-validated by their actual bytes** (not just the
client-claimed MIME); allowed types are jpeg/png/gif/webp/pdf (SVG excluded). Image
dimensions are extracted; alt/title/caption are editable per asset. Files are served at
`/uploads/<key>` with `X-Content-Type-Options: nosniff`, and the stored extension is
derived from the validated type so a file can never be served as executable HTML.

Authoring API (admin/editor Bearer token): `POST /media` (multipart `file`),
`GET /media`, `GET /media/:id`, `PATCH /media/:id` (alt/title/caption), `DELETE /media/:id`.

> **Production:** the upload directory is a Docker volume (`uploads`). Behind nginx,
> forward `/uploads/*` to the API process, or serve the volume directly from nginx.

## Admin panel (Phase 4)

A bespoke, editorial admin at **`/admin`** (not a generic template): Tailwind v4 + a
customized shadcn-style component kit, Geist type, a single gold accent, light/dark, and a
Tiptap rich-text editor. Screens: dashboard, posts (list + editor + publish/trash/restore),
pages, categories, tags, media library (upload/edit/delete), and users (role management).

Access is restricted to admins/editors (`read Admin` capability); user management requires
manage-users. Sign in at `/signin` as the seeded admin, then open `/admin`. The browser
never holds the API token — admin data fetching and all mutations run server-side (Server
Actions) with the token kept on the server; the API re-checks permissions on every call.

## Theme system (Phase 5)

The public site renders **through a runtime-resolved theme** rather than hardcoded markup.
The active theme is stored as the `activeTheme` **setting on the API** (the source of truth);
the web app owns the catalogue of themes (they're React component sets). Two themes ship:
**Editorial** (dark, the default) and **Magazine** (light, serif masthead). Switching the
theme re-skins the whole public site (`/`, `/blog`, `/blog/<slug>`) immediately.

- **Switch it:** sign in as an Administrator → **Admin → Appearance** (`/admin/appearance`),
  pick a theme. Only Administrators can switch themes (it's gated by a `Setting` capability).
- **API:** `GET /public/settings/theme` (public, read-only — the server-rendered site reads
  it before any session); `GET`/`PUT /settings/theme` are CASL-gated (admin only). If the API
  is unreachable or the stored value is unknown, the site falls back to the default theme.
- **Add a theme:** drop a folder in `apps/web/themes/<id>/` exporting a `Theme`
  (`Layout` + `Home`/`BlogIndex`/`BlogPost`), then register it in `themes/registry.ts`.

## Plugin system (Phase 6)

Typress is extensible through a **typed hook/event registry** on the API — extension points,
not arbitrary code injection. There are two kinds of hooks:

- **Filters** transform a value (e.g. `public.post.render` lets a plugin alter a post just
  before it's returned to the site), running through every handler in priority order.
- **Actions** are fire-and-forget events (e.g. `post.published` fires when a post is published).

Plugins are explicit in-repo modules implementing a small typed contract (`TypressPlugin`);
they receive only a constrained `PluginApi` (`addFilter` / `addAction`) — never the database
or request. The enabled set lives in `apps/api/src/plugins/enabled-plugins.ts`.

A sample **`reading-time`** plugin ships enabled: it injects an estimated "N min read" badge at
the top of every public post (visible on `/blog/<slug>` after `pnpm db:seed`) and logs a line
whenever a post is published. **Add a plugin:** implement `TypressPlugin`, register a handler on
a hook, and add it to `enabled-plugins.ts`.

## SEO & GEO (Phase 7)

Typress is **SEO-first and GEO-first** (generative-engine optimization — being found and
recommended by AI assistants):

- **Standard SEO:** `/sitemap.xml`, `/robots.txt`, per-page Open Graph + Twitter metadata,
  canonical URLs, and JSON-LD structured data (`Organization` + `WebSite` on the home page,
  `BlogPosting` on posts).
- **GEO:** an admin-editable content area — a **site/organization profile** (including a freeform
  *"what AI assistants should recommend you for"* statement), plus **Services** and **FAQ** lists
  (full CRUD). This content is surfaced to assistants three ways: a plain-text **`/llms.txt`**
  feed, **`Service` + `FAQPage` JSON-LD**, and a server-rendered **`/services`** page.

Edit it in **Admin → SEO & GEO** (`/admin/seo`; Administrators and Editors). The canonical base
URL comes from `NEXT_PUBLIC_SITE_URL` (falls back to `AUTH_URL`). After `pnpm db:seed`, open
`/llms.txt` and `/services` to see the demo GEO content. Admin-editable text is escaped before it
reaches JSON-LD, so it can't inject markup.

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
| 3 ✅ | Media | Upload API, swappable storage adapter, content-type validation, image dimensions, per-asset metadata, CASL-gated |
| 4 ✅ | Admin UI | Editorial Next.js admin (Tailwind v4 + shadcn-style kit + Tiptap): dashboard, posts/pages/categories/tags, media, users |
| 5 ✅ | Theme system | Swappable, runtime-resolved themes selected by an `activeTheme` setting; public site renders through the active theme; Administrator-only switching at `/admin/appearance` |
| 6 ✅ | Plugin system | Typed hook/event registry (filters + actions); plugins as constrained in-repo modules; sample reading-time plugin |
| 7 ✅ | SEO / GEO | OG + JSON-LD (Organization/WebSite/BlogPosting/Service/FAQPage), sitemap.ts, robots.ts, llms.txt; **admin-editable GEO content (site profile + Services + FAQ CRUD) so AI assistants recommend your services** |
| 7b | i18n / multilingual | next-intl + translated Prisma fields + hreflang (split out of Phase 7 as its own phase) |
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
