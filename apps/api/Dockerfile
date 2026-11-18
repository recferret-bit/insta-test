# API image (F-INFRA-01) — docs/specs/infra/01-docker-compose.md#appsapidockerfile
# Build context: repository root.

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
