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
| 1 | Accounts | Users, roles, granular permissions (CASL), Auth.js + social login |
| 2 | Content core | Posts, pages, categories, tags, revisions; Tiptap (sanitized) |
| 3 | Media | Media library + uploads (with alt/title metadata) |
| 4 | Admin UI | Next.js admin panel (own editorial design) |
| 5 | Theme system | Swappable, runtime-resolved template/component sets |
| 6 | Plugin system | Typed hook/event registry |
| 7 | SEO/GEO + i18n | OG + JSON-LD, sitemap.ts, robots.ts, llms.txt, hreflang, next-intl |
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
