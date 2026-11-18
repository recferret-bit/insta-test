import {
  AuthTokenResponseDto,
  ErrorResponseDto,
  MeResponseDto,
  UserProfileResponseDto,
  toPublicId,
} from "@insta/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hashToken } from "../../../src/data/crypto/token-generator.js";
import { toTx } from "../../../src/data/db/tx.js";
import { PgMediaRepository } from "../../../src/data/repositories/media.pg-repository.js";
import {
  buildTestApp,
  closeTestPool,
  createAuthedUser,
  FakeClock,
  getTestPool,
  insertFollow,
  insertMedia,
  insertStory,
  insertUser,
  resetDb,
  TEST_PASSWORD,
  truncateAll,
  type TestApp,
} from "../../helpers/index.js";

/** `F-ECOMM-02` / `F-ECOMM-03` against real PostgreSQL through the full composition root. */
describe("identity API", () => {
  const pool = getTestPool();
  const clock = new FakeClock("2026-11-17T10:00:00.000Z");
  let t: TestApp;
  /** Avatar attach needs PgMediaRepository (W01-03); skip those cases while it is still the w00 stub. */
  let mediaRepoReady = true;

  beforeAll(async () => {
    await resetDb(pool);
    const client = await pool.connect();
    try {
      await new PgMediaRepository(pool).findManyForUpdate([], toTx(client));
    } catch (err) {
      mediaRepoReady = !/not implemented/.test(String((err as Error).message));
    } finally {
      client.release();
    }
    t = await buildTestApp({ clock, rateLimit: false });
    await t.app.ready();
  });
  beforeEach(async () => {
    await truncateAll(pool);
    clock.set("2026-11-17T10:00:00.000Z");
  });
  afterAll(async () => {
    await t.close();
    await closeTestPool();
  });

  const expectError = (res: { statusCode: number; json(): unknown }, status: number, code: string) => {
    expect(res.statusCode).toBe(status);
    expect(ErrorResponseDto.parse(res.json()).error.code).toBe(code);
  };

  describe("POST /auth/signup", () => {
    const body = {
      username: "Alice_1",
      email: "Alice@Example.com",
      password: "password123",
      full_name: "Alice",
    };

    it("201 creates user + session and auto-logs in", async () => {
      const res = await t.app.inject({
        method: "POST",
        url: "/api/v1/auth/signup",
        payload: body,
        headers: { "user-agent": "integration-ua" },
      });
      expect(res.statusCode).toBe(201);
      const dto = AuthTokenResponseDto.parse(res.json());
      expect(dto.access_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(dto.expires_at).toBe("2026-12-17T10:00:00.000Z");
      expect(dto.user).toMatchObject({
        username: "alice_1",
        email: "alice@example.com",
        full_name: "Alice",
        bio: "",
        avatar_url: null,
        posts_count: 0,
        is_following: null,
        has_active_story: false,
      });
      const { rows } = await pool.query("SELECT user_agent, token_hash FROM sessions");
      expect(rows).toHaveLength(1);
      expect(rows[0].user_agent).toBe("integration-ua");
      expect(Buffer.compare(rows[0].token_hash, hashToken(dto.access_token))).toBe(0);
      const me = await t.app.inject({
        url: "/api/v1/me",
        headers: { authorization: `Bearer ${dto.access_token}` },
      });
      expect(me.statusCode).toBe(200);
    });

    it("400 on invalid body, reserved username or unknown fields", async () => {
      for (const payload of [
        { ...body, password: "short" },
        { ...body, username: "ab" },
        { ...body, email: "nope" },
        { ...body, username: "explore" },
        { ...body, extra: 1 },
      ]) {
        const res = await t.app.inject({ method: "POST", url: "/api/v1/auth/signup", payload });
        expectError(res, 400, "VALIDATION_FAILED");
      }
      expect((await pool.query("SELECT 1 FROM users")).rowCount).toBe(0);
    });

    it("409 USERNAME_TAKEN / EMAIL_TAKEN, no orphan session", async () => {
      await t.app.inject({ method: "POST", url: "/api/v1/auth/signup", payload: body });
      const dupUser = await t.app.inject({
        method: "POST",
        url: "/api/v1/auth/signup",
        payload: { ...body, email: "other@example.com" },
      });
      expectError(dupUser, 409, "USERNAME_TAKEN");
      const dupEmail = await t.app.inject({
        method: "POST",
        url: "/api/v1/auth/signup",
        payload: { ...body, username: "other" },
      });
      expectError(dupEmail, 409, "EMAIL_TAKEN");
      expect((await pool.query("SELECT 1 FROM sessions")).rowCount).toBe(1);
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      await insertUser(pool, { username: "bob", email: "bob@example.com" });
    });

    it("200 by username or email (case-insensitive)", async () => {
      for (const login of ["bob", "BOB@example.com"]) {
        const res = await t.app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: { login, password: TEST_PASSWORD },
        });
        expect(res.statusCode).toBe(200);
        expect(AuthTokenResponseDto.parse(res.json()).user.username).toBe("bob");
      }
      expect((await pool.query("SELECT 1 FROM sessions")).rowCount).toBe(2);
    });

    it("401 INVALID_CREDENTIALS for wrong password and unknown handle alike", async () => {
      const wrong = await t.app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { login: "bob", password: "wrong-password" },
      });
      const unknown = await t.app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { login: "ghost", password: "wrong-password" },
      });
      expectError(wrong, 401, "INVALID_CREDENTIALS");
      expectError(unknown, 401, "INVALID_CREDENTIALS");
      expect(ErrorResponseDto.parse(wrong.json()).error.message).toBe(
        ErrorResponseDto.parse(unknown.json()).error.message,
      );
    });

    it("400 on empty login", async () => {
      const res = await t.app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { login: "", password: "x" },
      });
      expectError(res, 400, "VALIDATION_FAILED");
    });
  });

  describe("POST /auth/logout", () => {
    it("204 revokes only the current session", async () => {
      const a = await createAuthedUser(pool);
      const login = await t.app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { login: a.user.username, password: TEST_PASSWORD },
      });
      const other = AuthTokenResponseDto.parse(login.json()).access_token;
      const res = await t.app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: a.headers });
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe("");
      expectError(await t.app.inject({ url: "/api/v1/me", headers: a.headers }), 401, "UNAUTHENTICATED");
      const still = await t.app.inject({ url: "/api/v1/me", headers: { authorization: `Bearer ${other}` } });
      expect(still.statusCode).toBe(200);
    });

    it("401 without a token", async () => {
      expectError(await t.app.inject({ method: "POST", url: "/api/v1/auth/logout" }), 401, "UNAUTHENTICATED");
    });
  });

  describe("GET /me", () => {
    it("200 own profile with email and counters", async () => {
      const a = await createAuthedUser(pool, { user: { posts_count: 2, followers_count: 5, bio: "hey" } });
      const res = await t.app.inject({ url: "/api/v1/me", headers: a.headers });
      expect(res.statusCode).toBe(200);
      const dto = MeResponseDto.strict().parse(res.json());
      expect(dto).toMatchObject({
        id: toPublicId("usr", a.user.id),
        email: a.user.email,
        bio: "hey",
        posts_count: 2,
        followers_count: 5,
        is_following: null,
      });
    });

    it("401 with missing or expired token", async () => {
      expectError(await t.app.inject({ url: "/api/v1/me" }), 401, "UNAUTHENTICATED");
      const expired = await createAuthedUser(pool, {
        session: {
          created_at: new Date("2026-10-01T00:00:00Z"),
          expires_at: new Date("2026-10-31T00:00:00Z"),
        },
      });
      expectError(
        await t.app.inject({ url: "/api/v1/me", headers: expired.headers }),
        401,
        "UNAUTHENTICATED",
      );
    });
  });

  describe("PATCH /me", () => {
    const patch = (headers: Record<string, string>, payload: unknown) =>
      t.app.inject({ method: "PATCH", url: "/api/v1/me", headers, payload: payload as object });

    it("200 updates username / full_name / bio", async () => {
      const a = await createAuthedUser(pool);
      const res = await patch(a.headers, { username: "New.Name", full_name: " N ", bio: "line1\nline2" });
      expect(res.statusCode).toBe(200);
      expect(MeResponseDto.parse(res.json())).toMatchObject({
        username: "new.name",
        full_name: "N",
        bio: "line1\nline2",
      });
      const { rows } = await pool.query("SELECT username, updated_at FROM users WHERE id = $1", [a.user.id]);
      expect(rows[0].username).toBe("new.name");
    });

    it("400 for empty body, unknown field, too-long bio, malformed avatar id", async () => {
      const a = await createAuthedUser(pool);
      for (const payload of [
        {},
        { email: "x@y.zz" },
        { bio: "x".repeat(151) },
        { avatar_media_id: "med_123" },
      ]) {
        expectError(await patch(a.headers, payload), 400, "VALIDATION_FAILED");
      }
    });

    it("401 without a token", async () => {
      expectError(await patch({}, { bio: "x" }), 401, "UNAUTHENTICATED");
    });

    it("409 USERNAME_TAKEN", async () => {
      await insertUser(pool, { username: "taken" });
      const a = await createAuthedUser(pool);
      expectError(await patch(a.headers, { username: "taken" }), 409, "USERNAME_TAKEN");
    });

    // Depends on PgMediaRepository.findManyForUpdate/markAttached (W01-03).
    describe("avatar", () => {
      beforeEach((ctx) => {
        if (!mediaRepoReady) ctx.skip();
      });

      it("200 attaches an uploaded avatar image; null removes it", async () => {
        const a = await createAuthedUser(pool);
        const m = await insertMedia(pool, { owner_id: a.user.id, purpose: "avatar", mime_type: "image/png" });
        const res = await patch(a.headers, { avatar_media_id: toPublicId("med", m.id) });
        expect(res.statusCode).toBe(200);
        expect(MeResponseDto.parse(res.json()).avatar_url).toBe(
          `${t.env.PUBLIC_API_URL}/media/${m.storage_key}`,
        );
        const media = await pool.query("SELECT status FROM media_assets WHERE id = $1", [m.id]);
        expect(media.rows[0].status).toBe("attached");
        const cleared = await patch(a.headers, { avatar_media_id: null });
        expect(MeResponseDto.parse(cleared.json()).avatar_url).toBeNull();
      });

      it("422 MEDIA_INVALID for wrong purpose, foreign or missing media; profile unchanged", async () => {
        const a = await createAuthedUser(pool, { user: { full_name: "Before" } });
        const b = await insertUser(pool);
        const post = await insertMedia(pool, { owner_id: a.user.id, purpose: "post" });
        const foreign = await insertMedia(pool, { owner_id: b.id, purpose: "avatar" });
        const missing = "med_" + "0".repeat(31) + "1";
        for (const id of [toPublicId("med", post.id), toPublicId("med", foreign.id), missing]) {
          expectError(
            await patch(a.headers, { full_name: "After", avatar_media_id: id }),
            422,
            "MEDIA_INVALID",
          );
        }
        const { rows } = await pool.query("SELECT full_name FROM users WHERE id = $1", [a.user.id]);
        expect(rows[0].full_name).toBe("Before");
      });
    });
  });

  describe("GET /users/{username}", () => {
    it("200 anonymous: no email, is_following null; case-insensitive path", async () => {
      const u = await insertUser(pool, { username: "carol", bio: "hi" });
      const res = await t.app.inject({ url: "/api/v1/users/CAROL" });
      expect(res.statusCode).toBe(200);
      const dto = UserProfileResponseDto.strict().parse(res.json());
      expect(dto).toMatchObject({ id: toPublicId("usr", u.id), username: "carol", is_following: null });
    });

    it("200 viewer flags: is_following, has_active_story; self → null; invalid token → anonymous", async () => {
      const viewer = await createAuthedUser(pool, { session: { created_at: clock.now() } });
      const carol = await insertUser(pool, { username: "carol" });
      await insertFollow(pool, { follower_id: viewer.user.id, followee_id: carol.id });
      const media = await insertMedia(pool, { owner_id: carol.id, purpose: "story", status: "attached" });
      const now = Date.now();
      await insertStory(pool, {
        author_id: carol.id,
        media_id: media.id,
        created_at: new Date(now - 60_000),
        expires_at: new Date(now + 3_600_000),
      });

      const res = await t.app.inject({ url: "/api/v1/users/carol", headers: viewer.headers });
      expect(UserProfileResponseDto.parse(res.json())).toMatchObject({
        is_following: true,
        has_active_story: true,
      });

      const self = await t.app.inject({
        url: `/api/v1/users/${viewer.user.username}`,
        headers: viewer.headers,
      });
      const selfDto = UserProfileResponseDto.strict().parse(self.json());
      expect(selfDto.is_following).toBeNull();

      const bad = await t.app.inject({
        url: "/api/v1/users/carol",
        headers: { authorization: "Bearer nope" },
      });
      expect(bad.statusCode).toBe(200);
      expect(UserProfileResponseDto.parse(bad.json()).is_following).toBeNull();
    });

    it("404 NOT_FOUND for unknown username", async () => {
      expectError(await t.app.inject({ url: "/api/v1/users/nobody" }), 404, "NOT_FOUND");
    });

    it("400 for an over-long username param", async () => {
      expectError(await t.app.inject({ url: `/api/v1/users/${"a".repeat(31)}` }), 400, "VALIDATION_FAILED");
    });
  });
});
