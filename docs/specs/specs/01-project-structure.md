# 01 — Targeted Project Structure

Feature: `F-CORE-01` (layered monorepo skeleton).

## Toolchain Baseline

| Concern | Choice |
|---|---|
| Language | TypeScript 5.x, `strict: true`, ESM everywhere |
| Runtime | Node.js 22 LTS |
| Package manager | npm workspaces (`apps/*`, `packages/*`) |
| API framework | Fastify 5 |
| Validation | Zod 3 (schemas live in `packages/contracts`) |
| DB driver | `pg` (node-postgres) with hand-written SQL; no ORM |
| Web | React 18 + Vite 5 + React Router 6 + TanStack Query 5 |
| Tests | Vitest (unit + integration), Playwright (smoke e2e) |
| Lint/format | ESLint (flat config) + Prettier |

## Directory Layout

```text
/
├── AGENTS.md / CLAUDE.md          # agent constitution (spec-first rule)
├── README.md                      # human quick start
├── package.json                   # npm workspaces root; shared scripts
├── tsconfig.base.json             # shared compiler options
├── eslint.config.js               # includes layer-boundary rules (F-CORE-02)
├── docker-compose.yml             # web + api + db stack (infra/01-docker-compose.md)
├── .env.example                   # every env var from infra/02-env-ci-and-probes.md
├── docs/
│   ├── specs/                     # THIS spec tree (7 categories)
│   ├── questions-and-limitations/ # per-wave gap ledgers + consolidated GAPS_AND_QUESTIONS.md
│   └── plan/                      # wave plans (created by wave-planner)
├── packages/
│   └── contracts/                 # shared wire contracts (no runtime deps besides zod)
│       └── src/
│           ├── ids.ts             # public ID prefixes + regexes
│           ├── errors.ts          # ErrorCode union + ErrorResponseDto schema
│           ├── pagination.ts      # cursor page schemas
│           ├── dto/<module>.ts    # Zod Req/Res DTO schemas per module
│           ├── events.ts          # SSE event schemas
│           └── index.ts
├── apps/
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── migrations/            # NNNN_<snake_name>.sql, forward-only
│   │   ├── src/
│   │   │   ├── main.ts            # composition root: config → pool → repos → services → http
│   │   │   ├── config/env.ts      # Zod-parsed process.env
│   │   │   ├── api/               # HTTP layer (thin)
│   │   │   │   ├── server.ts      # Fastify instance, plugins, error handler
│   │   │   │   ├── auth.plugin.ts # bearer token → AuthContext
│   │   │   │   ├── routes/<module>.routes.ts
│   │   │   │   ├── mappers/<module>.dto-mapper.ts   # DTO ↔ command / entity → DTO
│   │   │   │   └── sse/           # SSE hub + ticket store
│   │   │   ├── domain/            # business layer (framework-free)
│   │   │   │   ├── shared/        # ids, errors (DomainError), clock, events, Result helpers
│   │   │   │   ├── identity/      # User, Session, IdentityService, ports
│   │   │   │   ├── media/         # MediaAsset, MediaService, MediaStoragePort
│   │   │   │   ├── posts/         # Post, Comment, Like, PostService, CommentService, LikeService
│   │   │   │   ├── social/        # Follow, FollowService
│   │   │   │   ├── stories/       # Story, StoryView, StoryService
│   │   │   │   ├── notifications/ # Notification, NotificationService
│   │   │   │   ├── feed/          # FeedService (read model composition)
│   │   │   │   └── search/        # SearchService
│   │   │   ├── data/              # persistence + storage adapters
│   │   │   │   ├── db/            # pool.ts, tx.ts (unit of work), migrate.ts
│   │   │   │   ├── crypto/        # argon2id hasher, token generator, UUIDv7 IdGenerator
│   │   │   │   ├── rows/<module>.row.ts
│   │   │   │   ├── mappers/<module>.row-mapper.ts   # Row ↔ Entity
│   │   │   │   ├── repositories/<module>.pg-repository.ts
│   │   │   │   └── storage/local-media-storage.ts
│   │   │   └── jobs/              # in-process scheduled jobs (story/media cleanup)
│   │   └── test/
│   │       ├── unit/              # domain + mappers
│   │       └── integration/       # HTTP + real Postgres
│   └── web/
│       ├── Dockerfile
│       ├── nginx/                 # default.conf.template, 30-runtime-config.sh
│       ├── index.html
│       └── src/
│           ├── main.tsx / App.tsx
│           ├── config.ts          # reads window.__APP_CONFIG__
│           ├── api/               # typed client (fetch wrapper) + per-module endpoints
│           ├── state/             # TanStack Query hooks, ViewModels, DTO→VM mappers, session store
│           ├── ui/
│           │   ├── components/    # presentational components
│           │   ├── layout/        # AppShell, nav bars
│           │   └── pages/         # route-level pages
│           └── styles/            # tokens.css, global.css
└── .agents/skills/                # repo-local agent skills
```

## Module Boundaries

| Layer | May import | Must NOT import |
|---|---|---|
| `packages/contracts` | `zod` | anything under `apps/` |
| `apps/api/src/domain` | `domain/**`, Node built-ins (`node:crypto`) | `api/**`, `data/**`, `fastify`, `pg`, `@insta/contracts` |
| `apps/api/src/data` | `domain/**` (entities, ports), `pg`, Node built-ins | `api/**`, `@insta/contracts` |
| `apps/api/src/api` | `domain/**`, `@insta/contracts`, `fastify` | `data/**` (only `main.ts` wires adapters) |
| `apps/api/src/main.ts` | everything (composition root) | — |
| `apps/web/src/ui` | `state/**`, `styles/**` | `api/**` directly (go through `state/` hooks) |
| `apps/web/src/state` | `api/**`, `@insta/contracts` types | `ui/**` |
| `apps/web/src/api` | `@insta/contracts` | `state/**`, `ui/**` |

The `contracts` package is published inside the workspace as `@insta/contracts`.

## Ownership Prefixes (`owned_paths`)

Wave tasks declare `owned_paths` using these prefixes. A task may only edit files under its prefixes.

| Area | `owned_paths` prefix |
|---|---|
| Shared contracts | `packages/contracts/src/dto/<module>.ts`, `packages/contracts/src/events.ts` |
| API module (per domain module) | `apps/api/src/domain/<module>/`, `apps/api/src/data/{rows,mappers,repositories}/<module>.*`, `apps/api/src/api/{routes,mappers}/<module>.*`, `apps/api/test/**/<module>*` |
| Migrations | `apps/api/migrations/NNNN_*.sql` (one file per task; number reserved in the wave manifest) |
| API platform | `apps/api/src/{main.ts,config,api/server.ts,api/auth.plugin.ts,api/sse,data/db,data/storage,data/crypto,jobs}` |
| Web feature | `apps/web/src/ui/pages/<Feature>*`, `apps/web/src/state/<module>*`, `apps/web/src/api/<module>.ts` |
| Web platform | `apps/web/src/{main.tsx,App.tsx,config.ts,ui/layout,styles}`, `apps/web/nginx` |
| Infra | `docker-compose.yml`, `apps/*/Dockerfile`, `.env.example`, `.github/workflows/` |
| Specs | `docs/specs/<category>/` |

## Auto-Discovery Extension Points

- **API routes:** `api/server.ts` registers every `api/routes/*.routes.ts` module listed in `api/routes/index.ts` (one export line per module) — adding a module = one new file + one export line.
- **Migrations:** the runner applies every `migrations/NNNN_*.sql` in numeric order; adding a migration = new file.
- **Jobs:** `jobs/index.ts` exports an array of `ScheduledJob` objects (`name`, `intervalMs`, `run`).
- **Web routes:** `App.tsx` route table imports from `ui/pages/index.ts`.
- **SSE events:** new event types are added to the discriminated union in `packages/contracts/src/events.ts`.

## Frozen Module File Map

Frozen by `w00` (`W00-01`). Feature waves own files by these names and only replace stub bodies; they do not rename,
move or add sibling registries. `<m>` is the module folder name.

| Module | Domain (`apps/api/src/domain/<m>/`) | Data (`apps/api/src/data/{rows,mappers,repositories}/`) | Routes (`apps/api/src/api/routes/`) | Wave |
|---|---|---|---|---|
| shared | `ids.ts`, `errors.ts` (`DomainError`, `ErrorCode` copy, `notImplemented`), `limits.ts`, `clock.ts`, `id-generator.ts`, `pagination.ts`, `events.ts`, `unit-of-work.ts`, `index.ts` | — | — | w00 |
| identity | `user.entity.ts`, `session.entity.ts`, `views.ts`, `commands.ts`, `ports.ts`, `identity.service.ts` | `users.*`, `sessions.*` | `identity.routes.ts` (auth, me, `GET /users/{username}`) | w01 |
| media | `media-asset.entity.ts`, `commands.ts`, `ports.ts`, `media.service.ts` | `media.*` | `media.routes.ts` (`POST /media`, `GET /media/*`) | w01 |
| posts | `post.entity.ts`, `comment.entity.ts`, `like.entity.ts`, `views.ts`, `commands.ts`, `ports.ts`, `post.service.ts`, `like.service.ts`, `comment.service.ts` | `posts.*`, `likes.*`, `comments.*` | `posts.routes.ts`, `likes.routes.ts`, `comments.routes.ts` | w02 |
| social | `follow.entity.ts`, `views.ts`, `ports.ts`, `follow.service.ts` | `follows.*` | `social.routes.ts` | w03 |
| stories | `story.entity.ts`, `story-seen.entity.ts`, `views.ts`, `commands.ts`, `ports.ts`, `story.service.ts` | `stories.*` | `stories.routes.ts` | w04 |
| feed | `views.ts`, `ports.ts` (`FeedQueries`), `feed.service.ts` | `feed.*` | `feed.routes.ts` | w05 |
| search | `views.ts`, `ports.ts` (`SearchQueries`), `search.service.ts` | `search.*` | `search.routes.ts` (incl. `GET /hashtags/{tag}/posts`) | w05 |
| notifications | `notification.entity.ts` (w01), `views.ts`, `commands.ts`, `ports.ts`, `notification.service.ts` (w06) | `notifications.*` (write w01, read w06) | `notifications.routes.ts` | w01 / w06 |
| events (SSE) | — | — | `events.routes.ts` + `api/sse/` | w06 |

Data file suffixes: `data/rows/<group>.row.ts` (`<Name>Row` types), `data/mappers/<group>.row-mapper.ts`,
`data/repositories/<group>.pg-repository.ts`. Row groups: `users`, `sessions`, `media`, `posts` (`posts`,
`post_media`, `post_hashtags`), `likes`, `comments`, `follows`, `stories` (`stories`, `story_views`), `notifications`.

Conventions frozen with the map:

- **Service construction:** every service takes one `deps` object (`new PostService({ posts, media, users, uow, clock, ids })`), typed as `<Name>ServiceDeps` next to the class. Adding a dependency is then an additive change to the composition root.
- **Commands:** use-case input types (`RegisterUserCommand`, `CreatePostCommand`, …) live in `domain/<m>/commands.ts`; API DTO mappers produce them.
- **Unit of work:** `UnitOfWork.run(fn: (tx: Tx, events: EventCollector) => Promise<T>)`. Services add domain events to the collector; the `data/db` implementation publishes them only after `COMMIT`.
- **Stub bodies:** unimplemented methods `return notImplemented("<Service>.<method>")`, which throws `DomainError("INTERNAL")` → `500`.
- **Crypto adapters:** `apps/api/src/data/crypto/` holds `argon2-password-hasher.ts`, `token-generator.ts` and `uuidv7-id-generator.ts` (API platform owned).
- **Tests:** `apps/api/test/unit/<area>/`, `apps/api/test/integration/<area>/`, mapper tests in `apps/api/test/unit/mappers/<group>*`; contracts tests in `packages/contracts/test/`.
- **Type-checking:** there is no root `tsconfig.json`; `npm run typecheck` runs `tsc -b packages/contracts apps/api apps/web`. `apps/api/tsconfig.json` covers `src/` only (emits `dist/main.js`); API test typing uses a tsconfig inside `apps/api/test/`.
