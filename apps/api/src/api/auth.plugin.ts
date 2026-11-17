import type { FastifyInstance, FastifyRequest } from "fastify";

import type { AuthContext } from "../domain/identity/session.entity.js";
import { DomainError } from "../domain/shared/errors.js";

/**
 * Bearer-session resolution (specs/02-architecture-and-patterns.md#authentication--authorization-pattern,
 * external-communication/01-api-conventions.md#auth-levels). Every route declares
 * `config: { auth: "required" | "optional" | "none" }`.
 */
export type AuthLevel = "required" | "optional" | "none";

declare module "fastify" {
  interface FastifyContextConfig {
    auth?: AuthLevel;
  }
  interface FastifyRequest {
    /** Resolved bearer identity, or `null` when anonymous / `auth: "none"`. */
    auth: AuthContext | null;
  }
}

/** Satisfied by `IdentityService` (sha256(token) → active session). */
export interface Authenticator {
  authenticate(rawToken: string): Promise<AuthContext | null>;
}

const BEARER = /^Bearer\s+([A-Za-z0-9._~+/=-]+)\s*$/i;

/** Extracts the raw token from `Authorization: Bearer <token>`; anything malformed → `null`. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = BEARER.exec(header);
  return match?.[1] ?? null;
}

/**
 * Route auth level. Routes that omit `config.auth` default to `required` (fail closed);
 * the 404 handler and `OPTIONS` are treated as `none` so unknown routes return `404`, not `401`.
 */
export function authLevelOf(request: FastifyRequest): AuthLevel {
  // CORS preflights carry no credentials by design.
  if (request.is404 || request.method === "OPTIONS") return "none";
  return request.routeOptions.config?.auth ?? "required";
}

/** Throws `401 UNAUTHENTICATED` for anonymous callers; use in `auth: "optional"` routes when needed. */
export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw new DomainError("UNAUTHENTICATED", "Authentication required");
  return request.auth;
}

/**
 * Installs the auth hook on the root instance (so it applies to every route module).
 * `required`: missing/invalid/expired/revoked → `401 UNAUTHENTICATED`.
 * `optional`: invalid token → anonymous. `none`: token ignored.
 */
export function registerAuth(app: FastifyInstance, authenticator: Authenticator): void {
  app.decorateRequest("auth", null);
  app.addHook("onRequest", async (request) => {
    request.auth = null;
    const level = authLevelOf(request);
    if (level === "none") return;
    const token = extractBearerToken(request.headers.authorization);
    const ctx = token ? await authenticator.authenticate(token) : null;
    if (!ctx && level === "required") {
      throw new DomainError("UNAUTHENTICATED", "Authentication required");
    }
    request.auth = ctx;
  });
}
