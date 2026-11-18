import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { LIMITS } from "@insta/contracts";
import Fastify, { LogController, type FastifyInstance, type FastifyServerOptions } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";

import type { ApiServices } from "./app-services.js";
import { registerAuth } from "./auth.plugin.js";
import { errorHandler, notFoundHandler } from "./error-handler.js";
import { registerHealthRoutes, type HealthDeps } from "./health.js";
import { GLOBAL_RATE_LIMIT } from "./rate-limit.js";
import { API_V1, routeModules } from "./routes/index.js";
import type { SseHub } from "./sse/index.js";
import type { UrlBuilder } from "./url-builder.js";

/**
 * Fastify instance, cross-cutting plugins and the central error handler
 * (specs/02-architecture-and-patterns.md, external-communication/01-api-conventions.md).
 * Routes come only from `api/routes/index.ts`; `api/` never imports `data/` (main.ts wires adapters).
 */

export type ServerOptions = {
  services: ApiServices;
  sse: SseHub;
  urls: UrlBuilder;
  health: HealthDeps;
  /** Exact-match allow-list from `CORS_ORIGIN`. */
  corsOrigins: string[];
  /** `MEDIA_DIR` (static serving is registered by the media route module). */
  mediaDir: string;
  /** `RESPONSE_VALIDATION`: `strict` validates every response against its contract schema. */
  responseValidation: "off" | "strict";
  /** Pino level (`LOG_LEVEL`); `silent` in tests. */
  logLevel: string;
  /** Disable only in tests that intentionally exceed limits elsewhere (default `true`). */
  rateLimit?: boolean;
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/** `X-Request-Id` accepted if 8–64 `[A-Za-z0-9-]` chars, otherwise a fresh UUID. */
export function resolveRequestId(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  return value && REQUEST_ID_PATTERN.test(value) ? value : randomUUID();
}

const SECRET_QUERY_PARAMS = /([?&](?:ticket|token|access_token)=)[^&#]*/gi;

/** Redacts SSE tickets and tokens from logged URLs (internal-communication/02 — ticket redaction). */
export function redactUrl(url: string): string {
  return url.replace(SECRET_QUERY_PARAMS, "$1[REDACTED]");
}

/** Never log tokens, passwords, the `Authorization` header or tickets (infra/02 — secrets). */
export const LOG_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "headers.authorization",
  "password",
  "access_token",
  "ticket",
  "*.password",
  "*.access_token",
  "*.ticket",
  "body",
  "*.body",
];

export function loggerOptions(level: string): FastifyServerOptions["logger"] {
  return {
    level,
    redact: { paths: LOG_REDACT_PATHS, censor: "[REDACTED]" },
    serializers: {
      req: (req: { method: string; url: string; id?: string }) => ({
        method: req.method,
        url: redactUrl(req.url),
      }),
    },
  };
}

export async function buildServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions(options.logLevel),
    bodyLimit: LIMITS.jsonBodyBytesMax,
    requestIdHeader: false,
    logController: new LogController({ requestIdLogLabel: "request_id" }),
    genReqId: (req: IncomingMessage) => resolveRequestId(req.headers["x-request-id"]),
    // Graceful shutdown: in-flight requests get up to 10 s (infra/02 — graceful shutdown).
    forceCloseConnections: "idle",
    return503OnClosing: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(
    options.responseValidation === "strict" ? serializerCompiler : () => (data) => JSON.stringify(data),
  );
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  // Runs first for every request (incl. 404s and errors): request id echo + no-store on /api/v1.
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
    if (request.url.startsWith(API_V1)) reply.header("cache-control", "no-store");
  });

  await app.register(cors, {
    origin: options.corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id", "Retry-After"],
    credentials: false,
    strictPreflight: false,
  });

  registerAuth(app, options.services.identity);

  if (options.rateLimit !== false) {
    await app.register(rateLimit, {
      global: true,
      hook: "preParsing",
      max: GLOBAL_RATE_LIMIT.max,
      keyGenerator: GLOBAL_RATE_LIMIT.keyGenerator,
      timeWindow: GLOBAL_RATE_LIMIT.timeWindow,
      addHeadersOnExceeding: {
        "x-ratelimit-limit": false,
        "x-ratelimit-remaining": false,
        "x-ratelimit-reset": false,
      },
      addHeaders: {
        "x-ratelimit-limit": false,
        "x-ratelimit-remaining": false,
        "x-ratelimit-reset": false,
        "retry-after": true,
      },
    });
  }

  registerHealthRoutes(app, options.health);

  const routeDeps = {
    services: options.services,
    urls: options.urls,
    sse: options.sse,
    mediaDir: options.mediaDir,
  };
  for (const module of routeModules) {
    await app.register(module.plugin, routeDeps);
  }

  return app;
}
