import {
  ErrorResponseDto,
  FollowStateResponseDto,
  UserProfileResponseDto,
  UserSummaryPageResponseDto,
  toPublicId,
} from "@insta/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { UserRow } from "../../../src/data/rows/users.row.js";
import type { DomainEvent } from "../../../src/domain/shared/events.js";
import {
  buildTestApp,
  closeTestPool,
  createAuthedUser,
  FakeClock,
  getTestPool,
  insertFollow,
  insertMedia,
  insertUser,
  resetDb,
  truncateAll,
  type AuthedUser,
  type TestApp,
} from "../../helpers/index.js";

/** `F-ECOMM-07` / `F-BE-05` (+ `is_following` on `F-ECOMM-03`) against real PostgreSQL. */
describe("follows API", () => {
  const pool = getTestPool();
  const clock = new FakeClock("2026-11-18T12:00:00.000Z");
  let t: TestApp;
  let events: DomainEvent[];
  let alice: AuthedUser;
  let bob: AuthedUser;

  beforeAll(async () => {
    await resetDb(pool);
    t = await buildTestApp({ clock, rateLimit: false });
    t.bus.subscribe((e) => {
      events.push(e);
    });
    await t.app.ready();
  });
  beforeEach(async () => {
    await truncateAll(pool);
    clock.set("2026-11-18T12:00:00.000Z");
    events = [];
    alice = await createAuthedUser(pool, { user: { username: "alice" } });
    bob = await createAuthedUser(pool, { user: { username: "bob" } });
  });
  afterAll(async () => {
    await t.close();
    await closeTestPool();
  });

  const follow = (who: AuthedUser | null, username: string) =>
    t.app.inject({
      method: "PUT",
      url: `/api/v1/users/${username}/follow`,
      headers: who?.headers ?? {},
    });
  const unfollow = (who: AuthedUser | null, username: string) =>
    t.app.inject({
      method: "DELETE",
      url: `/api/v1/users/${username}/follow`,
      headers: who?.headers ?? {},
    });
  const list = (side: "followers" | "following", username: string, who: AuthedUser | null, qs = "") =>
    t.app.inject({
      method: "GET",
      url: `/api/v1/users/${username}/${side}${qs}`,
      headers: who?.headers ?? {},
    });
  const profile = (username: string, who: AuthedUser | null) =>
    t.app.inject({ method: "GET", url: `/api/v1/users/${username}`, headers: who?.headers ?? {} });

  async function counters(id: string): Promise<Pick<UserRow, "followers_count" | "following_count">> {
    const { rows } = await pool.query<UserRow>(
      "SELECT followers_count, following_count FROM users WHERE id = $1",
      [id],
    );
    return rows[0]!;
  }
  async function followNotifications(): Promise<{ recipient_id: string; actor_id: string }[]> {
    const { rows } = await pool.query(
      "SELECT recipient_id, actor_id FROM notifications WHERE type = 'follow'",
    );
    return rows;
  }
  /** Events are published on a microtask after COMMIT. */
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  const expectError = (res: { statusCode: number; json(): unknown }, status: number, code: string) => {
    expect(res.statusCode).toBe(status);
    expect(ErrorResponseDto.parse(res.json()).error.code).toBe(code);
  };

  describe("PUT /users/{username}/follow", () => {
    it("follows, updates both counters, creates a notification and emits events", async () => {
      const res = await follow(alice, "bob");
      expect(res.statusCode).toBe(200);
      expect(FollowStateResponseDto.parse(res.json())).toEqual({
        user_id: toPublicId("usr", bob.user.id),
        following: true,
        followers_count: 1,
      });
      expect(await counters(alice.user.id)).toEqual({ followers_count: 0, following_count: 1 });
      expect(await counters(bob.user.id)).toEqual({ followers_count: 1, following_count: 0 });
      const { rows } = await pool.query("SELECT created_at FROM follows WHERE follower_id = $1", [
        alice.user.id,
      ]);
      expect(rows[0].created_at.toISOString()).toBe("2026-11-18T12:00:00.000Z");
      expect(await followNotifications()).toEqual([{ recipient_id: bob.user.id, actor_id: alice.user.id }]);
      await flush();
      expect(events.map((e) => e.type)).toEqual(["UserFollowed", "NotificationCreated"]);
      expect(events[0]).toMatchObject({ followerId: alice.user.id, followeeId: bob.user.id });
      expect(events[1]).toMatchObject({ recipientId: bob.user.id });
    });

    it("is idempotent: repeat returns same state without side effects", async () => {
      await follow(alice, "bob");
      await flush();
      events = [];
      const res = await follow(alice, "BOB");
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ following: true, followers_count: 1 });
      expect(await counters(alice.user.id)).toEqual({ followers_count: 0, following_count: 1 });
      expect(await followNotifications()).toHaveLength(1);
      await flush();
      expect(events).toEqual([]);
    });

    it("self follow → 422 CANNOT_FOLLOW_SELF", async () => {
      expectError(await follow(alice, "alice"), 422, "CANNOT_FOLLOW_SELF");
      expect(await counters(alice.user.id)).toEqual({ followers_count: 0, following_count: 0 });
    });

    it("unknown user → 404; anonymous → 401", async () => {
      expectError(await follow(alice, "nobody"), 404, "NOT_FOUND");
      expectError(await follow(null, "bob"), 401, "UNAUTHENTICATED");
      const { rows } = await pool.query("SELECT count(*)::int AS n FROM follows");
      expect(rows[0].n).toBe(0);
    });
  });

  describe("DELETE /users/{username}/follow", () => {
    it("unfollows, decrements both counters and deletes the notification", async () => {
      await follow(alice, "bob");
      const res = await unfollow(alice, "bob");
      expect(res.statusCode).toBe(200);
      expect(FollowStateResponseDto.parse(res.json())).toEqual({
        user_id: toPublicId("usr", bob.user.id),
        following: false,
        followers_count: 0,
      });
      expect(await counters(alice.user.id)).toEqual({ followers_count: 0, following_count: 0 });
      expect(await counters(bob.user.id)).toEqual({ followers_count: 0, following_count: 0 });
      expect(await followNotifications()).toEqual([]);
    });

    it("is idempotent when not following (and for self)", async () => {
      const res = await unfollow(alice, "bob");
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ following: false, followers_count: 0 });
      expect((await unfollow(alice, "alice")).statusCode).toBe(200);
      expect(await counters(bob.user.id)).toEqual({ followers_count: 0, following_count: 0 });
    });

    it("unknown user → 404; anonymous → 401", async () => {
      expectError(await unfollow(alice, "nobody"), 404, "NOT_FOUND");
      expectError(await unfollow(null, "bob"), 401, "UNAUTHENTICATED");
    });
  });

  describe("is_following on GET /users/{username}", () => {
    it("tracks follow/unfollow for the viewer; null for anonymous and self", async () => {
      expect((await profile("bob", alice)).json()).toMatchObject({ is_following: false, followers_count: 0 });
      await follow(alice, "bob");
      const after = UserProfileResponseDto.parse((await profile("bob", alice)).json());
      expect(after).toMatchObject({ is_following: true, followers_count: 1 });
      expect((await profile("bob", null)).json()).toMatchObject({ is_following: null });
      expect((await profile("bob", bob)).json()).toMatchObject({ is_following: null });
      expect((await profile("alice", alice)).json()).toMatchObject({ following_count: 1 });
      expect((await profile("alice", bob)).json()).toMatchObject({ is_following: false });
      await unfollow(alice, "bob");
      expect((await profile("bob", alice)).json()).toMatchObject({ is_following: false, followers_count: 0 });
    });
  });

  describe("concurrency", () => {
    it("mutual follows/unfollows in parallel do not deadlock and keep counters exact", async () => {
      for (let round = 0; round < 15; round += 1) {
        const results = await Promise.all([follow(alice, "bob"), follow(bob, "alice")]);
        expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
        expect(await counters(alice.user.id)).toEqual({ followers_count: 1, following_count: 1 });
        expect(await counters(bob.user.id)).toEqual({ followers_count: 1, following_count: 1 });
        const undone = await Promise.all([unfollow(alice, "bob"), unfollow(bob, "alice")]);
        expect(undone.map((r) => r.statusCode)).toEqual([200, 200]);
        expect(await counters(alice.user.id)).toEqual({ followers_count: 0, following_count: 0 });
        expect(await counters(bob.user.id)).toEqual({ followers_count: 0, following_count: 0 });
      }
      expect(await followNotifications()).toEqual([]);
    });

    it("duplicate concurrent follows count once", async () => {
      const results = await Promise.all(Array.from({ length: 8 }, () => follow(alice, "bob")));
      expect(results.every((r) => r.statusCode === 200)).toBe(true);
      expect(await counters(bob.user.id)).toEqual({ followers_count: 1, following_count: 0 });
      expect(await counters(alice.user.id)).toEqual({ followers_count: 0, following_count: 1 });
      expect(await followNotifications()).toHaveLength(1);
    });
  });

  describe("GET followers / following", () => {
    it("lists newest relation first with followed_at, avatar and viewer is_following", async () => {
      const carol = await insertUser(pool, { username: "carol" });
      const avatar = await insertMedia(pool, { owner_id: carol.id, purpose: "avatar", status: "attached" });
      await pool.query("UPDATE users SET avatar_media_id = $1 WHERE id = $2", [avatar.id, carol.id]);
      await follow(alice, "bob");
      clock.advance(1000);
      await insertFollow(pool, {
        follower_id: carol.id,
        followee_id: bob.user.id,
        created_at: clock.now(),
      });
      await follow(alice, "carol");

      const res = await list("followers", "bob", alice);
      expect(res.statusCode).toBe(200);
      const body = UserSummaryPageResponseDto.parse(res.json());
      expect(body.next_cursor).toBeNull();
      expect(body.items.map((i) => i.username)).toEqual(["carol", "alice"]);
      expect(body.items[0]).toMatchObject({
        id: toPublicId("usr", carol.id),
        is_following: true,
        followed_at: "2026-11-18T12:00:01.000Z",
      });
      expect(body.items[0]!.avatar_url).toMatch(new RegExp(`/media/${avatar.storage_key}$`));
      expect(body.items[1]).toMatchObject({ is_following: null, followed_at: "2026-11-18T12:00:00.000Z" });

      const anon = UserSummaryPageResponseDto.parse((await list("followers", "bob", null)).json());
      expect(anon.items.every((i) => i.is_following === null)).toBe(true);

      const following = UserSummaryPageResponseDto.parse((await list("following", "alice", bob)).json());
      expect(following.items.map((i) => i.username)).toEqual(["carol", "bob"]);
      expect(following.items.map((i) => i.is_following)).toEqual([false, null]);
    });

    it("paginates with a cursor without gaps or duplicates (ties + microsecond timestamps)", async () => {
      const followers: string[] = [];
      for (let i = 0; i < 7; i += 1) {
        const u = await insertUser(pool);
        followers.push(u.username);
        // Three rows share one timestamp (tie-break on id); the rest use DEFAULT now() (µs precision).
        await insertFollow(pool, {
          follower_id: u.id,
          followee_id: bob.user.id,
          ...(i < 3 ? { created_at: new Date("2026-11-18T11:00:00.000Z") } : {}),
        });
      }
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const qs: string = `?limit=3${cursor ? `&cursor=${cursor}` : ""}`;
        const res = await list("followers", "bob", null, qs);
        expect(res.statusCode).toBe(200);
        const body = UserSummaryPageResponseDto.parse(res.json());
        expect(body.items.length).toBeLessThanOrEqual(3);
        seen.push(...body.items.map((i) => i.username));
        cursor = body.next_cursor;
        pages += 1;
      } while (cursor && pages < 10);
      expect(pages).toBe(3);
      expect([...seen].sort()).toEqual([...followers].sort());
      expect(new Set(seen).size).toBe(7);
    });

    it("unknown user → 404; bad cursor / limit → 400", async () => {
      expectError(await list("followers", "nobody", null), 404, "NOT_FOUND");
      expectError(await list("following", "nobody", null), 404, "NOT_FOUND");
      expectError(await list("followers", "bob", null, "?cursor=not-a-cursor"), 400, "VALIDATION_FAILED");
      expectError(await list("following", "bob", null, "?limit=0"), 400, "VALIDATION_FAILED");
      expectError(await list("following", "bob", null, "?limit=51"), 400, "VALIDATION_FAILED");
    });

    it("empty lists", async () => {
      const res = await list("following", "bob", null);
      expect(res.json()).toEqual({ items: [], next_cursor: null });
    });
  });
});
