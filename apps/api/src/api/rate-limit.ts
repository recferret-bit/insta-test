import type { FastifyRequest } from "fastify";

/**
 * Rate limits (external-communication/01-api-conventions.md#rate-limits), in-memory per process.
 * The global limiter runs on `preParsing`, i.e. after `auth.plugin.ts` resolved `request.auth`
 * (`onRequest`), so per-user buckets can key on the user id.
 */

export const RATE_LIMIT_WINDOW_MS = 60_000;

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isRead(request: FastifyRequest): boolean {
  return READ_METHODS.has(request.method);
}

/** Per-IP key. */
export function ipKey(request: FastifyRequest): string {
  return `ip:${request.ip}`;
}

/** Per-user key; anonymous callers fall back to their IP. */
export function userOrIpKey(request: FastifyRequest): string {
  return request.auth ? `user:${request.auth.userId}` : ipKey(request);
}

/** Global defaults: reads 600/min per IP; other mutating endpoints 120/min per user. */
export const GLOBAL_RATE_LIMIT = {
  max: (request: FastifyRequest): number => (isRead(request) ? 600 : 120),
  keyGenerator: (request: FastifyRequest): string =>
    isRead(request) ? `read:${ipKey(request)}` : `write:${userOrIpKey(request)}`,
  timeWindow: RATE_LIMIT_WINDOW_MS,
};

/**
 * Route-level presets for `config.rateLimit` (each route gets its own bucket):
 * - `auth`: `POST /auth/login`, `POST /auth/signup` — 10/min per IP.
 * - `upload`: `POST /media` — 30/min per user.
 */
export const RATE_LIMIT_PRESETS = {
  auth: { max: 10, timeWindow: RATE_LIMIT_WINDOW_MS, keyGenerator: ipKey },
  upload: { max: 30, timeWindow: RATE_LIMIT_WINDOW_MS, keyGenerator: userOrIpKey },
} as const;
