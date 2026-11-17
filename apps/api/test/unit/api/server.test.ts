import { ErrorResponseDto } from "@insta/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ApiServices } from "../../../src/api/app-services.js";
import { buildServer, redactUrl, resolveRequestId } from "../../../src/api/server.js";
import { createSseHub } from "../../../src/api/sse/index.js";
import { createUrlBuilder } from "../../../src/api/url-builder.js";
import type { AuthContext } from "../../../src/domain/identity/session.entity.js";
import { DomainError, notImplemented } from "../../../src/domain/shared/errors.js";
import type { SessionId, UserId } from "../../../src/domain/shared/ids.js";

const VALID_TOKEN = "valid-token-0123456789";
const AUTH: AuthContext = {
  userId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as UserId,
  sessionId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c" as SessionId,
};

async function build(
  opts: {
    db?: "ok" | "down";
    rateLimit?: boolean;
    authenticate?: (t: string) => Promise<AuthContext | null>;
  } = {},
) {
  const authenticate = vi.fn(opts.authenticate ?? (async (t: string) => (t === VALID_TOKEN ? AUTH : null)));
  const services = { identity: { authenticate } } as unknown as ApiServices;
  const app = await buildServer({
    services,
    sse: createSseHub(),
    urls: createUrlBuilder("http://localhost:18001"),
    health: { readiness: async () => ({ db: opts.db ?? "ok" }), version: "abc123" },
    corsOrigins: ["http://localhost:18000"],
    mediaDir: "/tmp",
    responseValidation: "strict",
    logLevel: "silent",
    rateLimit: opts.rateLimit ?? true,
  });

  // Test-only routes proving the envelope for each error class.
  app.get("/api/v1/__test/domain", { config: { auth: "none" } }, async () => {
    throw new DomainError("FORBIDDEN", "Not your post");
  });
  app.get("/api/v1/__test/stub", { config: { auth: "none" } }, async () => notImplemented("X.y"));
  app.get("/api/v1/__test/crash", { config: { auth: "none" } }, async () => {
    throw new Error("db password=hunter2 leaked?");
  });
  app.post(
    "/api/v1/__test/validate",
    {
      config: { auth: "none" },
      schema: { body: z.object({ caption: z.string().max(5), n: z.number().int() }).strict() },
    },
    async () => ({ ok: true }),
  );
  app.get(
    "/api/v1/__test/bad-response",
    { config: { auth: "none" }, schema: { response: { 200: z.object({ id: z.string() }) } } },
    async () => ({ id: 1 }) as unknown as { id: string },
  );
  app.get("/api/v1/__test/required", { config: { auth: "required" } }, async (req) => ({
    user: req.auth?.userId,
  }));
  app.get("/api/v1/__test/default", async (req) => ({ user: req.auth?.userId }));
  app.get("/api/v1/__test/optional", { config: { auth: "optional" } }, async (req) => ({
    user: req.auth?.userId ?? null,
  }));
  app.get("/api/v1/__test/none", { config: { auth: "none" } }, async (req) => ({
    user: req.auth?.userId ?? null,
  }));
  app.post("/api/v1/__test/write", { config: { auth: "optional" } }, async () => ({ ok: true }));
  await app.ready();
  return { app, authenticate };
}

function envelope(body: string) {
  return ErrorResponseDto.parse(JSON.parse(body));
}

describe("api/server.ts platform", () => {
  let app: FastifyInstance;
  let authenticate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    ({ app, authenticate } = await build());
  });
  afterEach(async () => {
    await app.close();
  });

  describe("error envelope (F-CORE-05)", () => {
    it("400 VALIDATION_FAILED with details[] from the zod schema", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/__test/validate",
        payload: { caption: "toolong", n: 1.5 },
      });
      expect(res.statusCode).toBe(400);
      const body = envelope(res.body);
      expect(body.error.code).toBe("VALIDATION_FAILED");
      expect(body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "caption" }),
          expect.objectContaining({ path: "n" }),
        ]),
      );
      expect(body.error.request_id).toBe(res.headers["x-request-id"]);
    });

    it("400 for unknown keys (strict) and malformed JSON", async () => {
      const strict = await app.inject({
        method: "POST",
        url: "/api/v1/__test/validate",
        payload: { caption: "a", n: 1, x: 1 },
      });
      expect(envelope(strict.body).error.code).toBe("VALIDATION_FAILED");
      const malformed = await app.inject({
        method: "POST",
        url: "/api/v1/__test/validate",
        headers: { "content-type": "application/json" },
        payload: "{nope",
      });
      expect(malformed.statusCode).toBe(400);
      expect(envelope(malformed.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("413 PAYLOAD_TOO_LARGE for JSON bodies over 64 KiB", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/__test/validate",
        payload: { caption: "x".repeat(70 * 1024), n: 1 },
      });
      expect(res.statusCode).toBe(413);
      expect(envelope(res.body).error.code).toBe("PAYLOAD_TOO_LARGE");
    });

    it("DomainError → mapped status and message", async () => {
      const res = await app.inject({ url: "/api/v1/__test/domain" });
      expect(res.statusCode).toBe(403);
      expect(envelope(res.body).error).toMatchObject({ code: "FORBIDDEN", message: "Not your post" });
      expect(envelope(res.body).error.details).toBeUndefined();
    });

    it("404 NOT_FOUND for unknown routes (no auth needed)", async () => {
      const res = await app.inject({ url: "/api/v1/nope" });
      expect(res.statusCode).toBe(404);
      expect(envelope(res.body).error.code).toBe("NOT_FOUND");
      expect(authenticate).not.toHaveBeenCalled();
    });

    it("500 INTERNAL hides the message for crashes and stubbed services", async () => {
      for (const url of ["/api/v1/__test/crash", "/api/v1/__test/stub"]) {
        const res = await app.inject({ url });
        expect(res.statusCode).toBe(500);
        const body = envelope(res.body);
        expect(body.error).toMatchObject({ code: "INTERNAL", message: "Internal server error" });
        expect(res.body).not.toContain("hunter2");
      }
    });

    it("strict response validation turns contract drift into 500 INTERNAL", async () => {
      const res = await app.inject({ url: "/api/v1/__test/bad-response" });
      expect(res.statusCode).toBe(500);
      expect(envelope(res.body).error.code).toBe("INTERNAL");
    });
  });

  describe("headers", () => {
    it("echoes a valid X-Request-Id and replaces an invalid one", async () => {
      const ok = await app.inject({ url: "/api/v1/__test/none", headers: { "x-request-id": "abcDEF-1234" } });
      expect(ok.headers["x-request-id"]).toBe("abcDEF-1234");
      const bad = await app.inject({ url: "/api/v1/__test/domain", headers: { "x-request-id": "bad id!" } });
      expect(bad.headers["x-request-id"]).not.toBe("bad id!");
      expect(bad.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
      expect(envelope(bad.body).error.request_id).toBe(bad.headers["x-request-id"]);
    });

    it("sets Cache-Control: no-store on /api/v1 (including errors) but not on /healthz", async () => {
      expect((await app.inject({ url: "/api/v1/__test/none" })).headers["cache-control"]).toBe("no-store");
      expect((await app.inject({ url: "/api/v1/nope" })).headers["cache-control"]).toBe("no-store");
      expect((await app.inject({ url: "/healthz" })).headers["cache-control"]).toBeUndefined();
    });

    it("CORS: exact-origin allow-list, exposed headers, preflight without auth", async () => {
      const allowed = await app.inject({
        url: "/api/v1/__test/none",
        headers: { origin: "http://localhost:18000" },
      });
      expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:18000");
      expect(String(allowed.headers["access-control-expose-headers"])).toContain("X-Request-Id");
      const denied = await app.inject({
        url: "/api/v1/__test/none",
        headers: { origin: "http://evil.test" },
      });
      expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
      const preflight = await app.inject({
        method: "OPTIONS",
        url: "/api/v1/__test/required",
        headers: {
          origin: "http://localhost:18000",
          "access-control-request-method": "POST",
          "access-control-request-headers": "authorization,content-type",
        },
      });
      expect(preflight.statusCode).toBe(204);
      expect(String(preflight.headers["access-control-allow-headers"])).toContain("Authorization");
      expect(preflight.headers["access-control-allow-credentials"]).toBeUndefined();
    });
  });

  describe("auth levels", () => {
    it("required: missing / malformed / unknown token → 401 UNAUTHENTICATED", async () => {
      for (const headers of [{}, { authorization: "Basic abc" }, { authorization: "Bearer nope" }]) {
        const res = await app.inject({ url: "/api/v1/__test/required", headers });
        expect(res.statusCode).toBe(401);
        expect(envelope(res.body).error.code).toBe("UNAUTHENTICATED");
      }
    });

    it("required: valid token → AuthContext attached", async () => {
      const res = await app.inject({
        url: "/api/v1/__test/required",
        headers: { authorization: `bearer ${VALID_TOKEN}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ user: AUTH.userId });
      expect(authenticate).toHaveBeenCalledWith(VALID_TOKEN);
    });

    it("routes without config.auth default to required (fail closed)", async () => {
      expect((await app.inject({ url: "/api/v1/__test/default" })).statusCode).toBe(401);
    });

    it("optional: invalid token → anonymous; valid → viewer", async () => {
      const anon = await app.inject({
        url: "/api/v1/__test/optional",
        headers: { authorization: "Bearer nope" },
      });
      expect(anon.json()).toEqual({ user: null });
      const viewer = await app.inject({
        url: "/api/v1/__test/optional",
        headers: { authorization: `Bearer ${VALID_TOKEN}` },
      });
      expect(viewer.json()).toEqual({ user: AUTH.userId });
    });

    it("none: token ignored (not even looked up)", async () => {
      const res = await app.inject({
        url: "/api/v1/__test/none",
        headers: { authorization: `Bearer ${VALID_TOKEN}` },
      });
      expect(res.json()).toEqual({ user: null });
      expect(authenticate).not.toHaveBeenCalled();
    });
  });

  describe("health probes (F-INFRA-07)", () => {
    it("GET /healthz → 200 {status:ok}", async () => {
      const res = await app.inject({ url: "/healthz" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "ok" });
    });

    it("GET /api/v1/health → 200 with version when the DB is ready", async () => {
      const res = await app.inject({ url: "/api/v1/health" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "ok", db: "ok", version: "abc123" });
    });

    it("GET /api/v1/health → 503 degraded when the DB is down", async () => {
      const down = await build({ db: "down" });
      try {
        const res = await down.app.inject({ url: "/api/v1/health" });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toEqual({ status: "degraded", db: "down" });
      } finally {
        await down.app.close();
      }
    });
  });

  describe("route modules", () => {
    it("stub feature modules register no routes yet → 404", async () => {
      expect((await app.inject({ url: "/api/v1/feed" })).statusCode).toBe(404);
    });
  });
});

describe("rate limits", () => {
  it("mutating endpoints: 120/min per caller → 429 RATE_LIMITED with Retry-After", async () => {
    const { app } = await build();
    try {
      for (let i = 0; i < 120; i += 1) {
        expect((await app.inject({ method: "POST", url: "/api/v1/__test/write" })).statusCode).toBe(200);
      }
      const limited = await app.inject({ method: "POST", url: "/api/v1/__test/write" });
      expect(limited.statusCode).toBe(429);
      expect(envelope(limited.body).error.code).toBe("RATE_LIMITED");
      expect(limited.headers["retry-after"]).toBeDefined();
      // Reads use a separate bucket.
      expect((await app.inject({ url: "/api/v1/__test/none" })).statusCode).toBe(200);
      // Health probes are never limited.
      expect((await app.inject({ url: "/healthz" })).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("per-user buckets: another user is not affected", async () => {
    const other = "other-token-0123456789";
    const { app } = await build({
      authenticate: async (t) =>
        t === VALID_TOKEN ? AUTH : t === other ? { ...AUTH, userId: "u2" as UserId } : null,
    });
    try {
      for (let i = 0; i < 120; i += 1) {
        await app.inject({
          method: "POST",
          url: "/api/v1/__test/write",
          headers: { authorization: `Bearer ${VALID_TOKEN}` },
        });
      }
      const first = await app.inject({
        method: "POST",
        url: "/api/v1/__test/write",
        headers: { authorization: `Bearer ${VALID_TOKEN}` },
      });
      expect(first.statusCode).toBe(429);
      const second = await app.inject({
        method: "POST",
        url: "/api/v1/__test/write",
        headers: { authorization: `Bearer ${other}` },
      });
      expect(second.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});

describe("helpers", () => {
  it("resolveRequestId accepts 8–64 [A-Za-z0-9-] only", () => {
    expect(resolveRequestId("abcd1234")).toBe("abcd1234");
    expect(resolveRequestId("a".repeat(64))).toBe("a".repeat(64));
    expect(resolveRequestId("a".repeat(65))).not.toBe("a".repeat(65));
    expect(resolveRequestId("short")).not.toBe("short");
    expect(resolveRequestId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("redactUrl hides tickets and tokens", () => {
    expect(redactUrl("/api/v1/events/stream?ticket=abc&x=1")).toBe(
      "/api/v1/events/stream?ticket=[REDACTED]&x=1",
    );
    expect(redactUrl("/x?a=1&access_token=zzz")).toBe("/x?a=1&access_token=[REDACTED]");
    expect(redactUrl("/plain")).toBe("/plain");
  });
});
