import { ErrorResponseDto } from "@insta/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  closeTestPool,
  createAuthedUser,
  FakeClock,
  getTestPool,
  resetDb,
  type TestApp,
  buildTestApp,
} from "../../helpers/index.js";

/** Composition root + real Postgres: health readiness and bearer-session resolution. */
describe("API platform against PostgreSQL", () => {
  const pool = getTestPool();
  const clock = new FakeClock("2026-11-17T10:00:00.000Z");
  let t: TestApp;

  beforeAll(async () => {
    await resetDb(pool);
    t = await buildTestApp({ clock });
    t.app.get("/api/v1/__test/whoami", { config: { auth: "required" } }, async (req) => ({
      user_id: req.auth?.userId,
      session_id: req.auth?.sessionId,
    }));
    t.app.get("/api/v1/__test/viewer", { config: { auth: "optional" } }, async (req) => ({
      user_id: req.auth?.userId ?? null,
    }));
    await t.app.ready();
  });
  afterAll(async () => {
    await t.close();
    await closeTestPool();
  });

  describe("health", () => {
    it("GET /api/v1/health → 200 when the DB is reachable and migrated", async () => {
      const res = await t.app.inject({ url: "/api/v1/health" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "ok", db: "ok", version: "test" });
    });

    it("GET /healthz → 200", async () => {
      expect((await t.app.inject({ url: "/healthz" })).json()).toEqual({ status: "ok" });
    });
  });

  describe("bearer sessions", () => {
    it("active session → AuthContext", async () => {
      const authed = await createAuthedUser(pool, { session: { created_at: clock.now() } });
      const res = await t.app.inject({ url: "/api/v1/__test/whoami", headers: authed.headers });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ user_id: authed.user.id, session_id: authed.session.id });
    });

    it("revoked session → 401 UNAUTHENTICATED (required) / anonymous (optional)", async () => {
      const authed = await createAuthedUser(pool, {
        session: {
          created_at: new Date("2026-11-16T00:00:00Z"),
          revoked_at: new Date("2026-11-17T09:00:00Z"),
        },
      });
      const res = await t.app.inject({ url: "/api/v1/__test/whoami", headers: authed.headers });
      expect(res.statusCode).toBe(401);
      expect(ErrorResponseDto.parse(res.json()).error.code).toBe("UNAUTHENTICATED");
      const optional = await t.app.inject({ url: "/api/v1/__test/viewer", headers: authed.headers });
      expect(optional.json()).toEqual({ user_id: null });
    });

    it("expired session → 401; expiry boundary uses the injected clock", async () => {
      const expiresAt = new Date("2026-11-17T12:00:00.000Z");
      const authed = await createAuthedUser(pool, {
        session: { created_at: new Date("2026-11-01T00:00:00Z"), expires_at: expiresAt },
      });
      clock.set("2026-11-17T11:59:59.999Z");
      expect((await t.app.inject({ url: "/api/v1/__test/whoami", headers: authed.headers })).statusCode).toBe(
        200,
      );
      clock.set(expiresAt);
      const res = await t.app.inject({ url: "/api/v1/__test/whoami", headers: authed.headers });
      expect(res.statusCode).toBe(401);
      expect(ErrorResponseDto.parse(res.json()).error.code).toBe("UNAUTHENTICATED");
      clock.set("2026-11-17T10:00:00.000Z");
    });

    it("unknown token and missing header → 401", async () => {
      for (const headers of [{ authorization: "Bearer not-a-real-token" }, {}]) {
        const res = await t.app.inject({ url: "/api/v1/__test/whoami", headers });
        expect(res.statusCode).toBe(401);
      }
    });
  });

  describe("stub feature services", () => {
    it("unimplemented service methods surface as 500 INTERNAL", async () => {
      await expect(t.services.feed.explore(null, { cursor: null, limit: 20 })).rejects.toMatchObject({
        code: "INTERNAL",
      });
    });
  });
});
