# Web image (F-INFRA-02) — docs/specs/infra/01-docker-compose.md#appswebdockerfile
# Build context: repository root.

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
