# 01 — Dockerfiles & Compose Stack

Features: `F-INFRA-01` … `F-INFRA-04`.

## `apps/api/Dockerfile`

```dockerfile
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace apps/api --workspace packages/contracts --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build -w packages/contracts && npm run build -w apps/api \
 && npm prune --omit=dev --workspace apps/api --workspace packages/contracts

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages/contracts ./packages/contracts
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/migrations ./apps/api/migrations
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/
RUN mkdir -p /data/media && chown node:node /data/media
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
```

`main.js` runs migrations first when `MIGRATE_ON_START=true`.

## `apps/web/Dockerfile`

```dockerfile
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/web --workspace packages/contracts --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN npm run build -w packages/contracts && npm run build -w apps/web

FROM nginx:1.27-alpine
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY apps/web/nginx/30-runtime-config.sh /docker-entrypoint.d/30-runtime-config.sh
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
```

- `default.conf.template`: `listen 8080;` SPA fallback `try_files $uri /index.html;`; `location = /healthz { return 200 'ok'; }`; `/assets/` with `Cache-Control: public, max-age=31536000, immutable`; `index.html` and `config.js` with `no-store`; CSP header `default-src 'self'; img-src 'self' ${PUBLIC_API_URL} data: blob:; media-src 'self' ${PUBLIC_API_URL} blob:; connect-src 'self' ${PUBLIC_API_URL}`.
- `30-runtime-config.sh`: writes `/usr/share/nginx/html/config.js` → `window.__APP_CONFIG__ = { apiUrl: "${PUBLIC_API_URL}", publicUrl: "${PUBLIC_URL}" };`.

## `docker-compose.yml`

```yaml
name: ${COMPOSE_PROJECT_NAME:-insta}

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-insta}
      POSTGRES_USER: ${POSTGRES_USER:-insta}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 20
    networks: [internal]
    # no host ports: db is internal-only

  api:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    depends_on:
      db: { condition: service_healthy }
    environment:
      NODE_ENV: production
      API_PORT: 3000
      DATABASE_URL: postgres://${POSTGRES_USER:-insta}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-insta}
      PUBLIC_URL: ${PUBLIC_URL}
      PUBLIC_API_URL: ${PUBLIC_API_URL}
      CORS_ORIGIN: ${CORS_ORIGIN}
      MEDIA_DIR: /data/media
      MIGRATE_ON_START: "true"
      JOBS_ENABLED: "true"
      SESSION_TTL_DAYS: ${SESSION_TTL_DAYS:-30}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    volumes:
      - media:/data/media
    ports:
      - "${API_HOST_PORT:-18001}:3000"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1"]
      interval: 10s
      timeout: 3s
      start_period: 20s
      retries: 6
    networks: [internal, edge]

  web:
    build: { context: ., dockerfile: apps/web/Dockerfile }
    depends_on:
      api: { condition: service_healthy }
    environment:
      PUBLIC_URL: ${PUBLIC_URL}
      PUBLIC_API_URL: ${PUBLIC_API_URL}
    ports:
      - "${WEB_HOST_PORT:-18000}:8080"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8080/healthz || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 6
    networks: [edge]

volumes:
  db-data:
  media:

networks:
  internal:
    internal: true
  edge:
```

Network layout: `db` is attached only to `internal` (`internal: true` → no external routing, no published port). `api` joins `internal` (DB access) and `edge` (published port). `web` joins only `edge`; the browser talks to `api` directly via `PUBLIC_API_URL`, so nginx does not proxy API traffic.

## Per-Wave Port Blocks (`WAVE_PORT_BASE`)

Each wave preview gets a block of 10 host ports starting at `WAVE_PORT_BASE` (default `18000`; wave `wNN` uses `18000 + NN * 10`).

| Offset | Variable | Service | Default (base 18000) |
|---|---|---|---|
| +0 | `WEB_HOST_PORT` | `web` | 18000 |
| +1 | `API_HOST_PORT` | `api` | 18001 |
| +2 | `DB_HOST_PORT` | `db` (only via `docker-compose.dev.yml` override, never in previews) | 18002 |
| +3 … +9 | reserved | — | — |

Derived URLs (rendered by the `wave-compose-deploy` skill into `.env.wave-<wNN>`):

```text
COMPOSE_PROJECT_NAME=insta-<wNN>
WEB_HOST_PORT=<base+0>
API_HOST_PORT=<base+1>
PUBLIC_URL=http://<host>:<base+0>
PUBLIC_API_URL=http://<host>:<base+1>
CORS_ORIGIN=http://<host>:<base+0>
```

Isolation: distinct `COMPOSE_PROJECT_NAME` namespaces containers, networks, and volumes (`insta-w03_db-data`, …). Teardown: `docker compose -p insta-<wNN> down -v`.

## Local Development Override (`docker-compose.dev.yml`)

Publishes `db` on `DB_HOST_PORT` so `npm run dev` (API with `tsx watch`, web with Vite dev server on 5173) can run on the host against the containerized DB.
