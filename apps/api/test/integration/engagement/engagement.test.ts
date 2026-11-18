import {
  CommentPageResponseDto,
  CommentResponseDto,
  ErrorResponseDto,
  LikeStateResponseDto,
  toPublicId,
  UserSummaryPageResponseDto,
} from "@insta/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PostRow } from "../../../src/data/rows/posts.row.js";
import type { DomainEvent } from "../../../src/domain/shared/events.js";
import {
  buildTestApp,
  closeTestPool,
  createAuthedUser,
  FakeClock,
  getTestPool,
  insertComment,
  insertFollow,
  insertLike,
  insertPostWithMedia,
  resetDb,
  truncateAll,
  type AuthedUser,
  type TestApp,
} from "../../helpers/index.js";

/** `F-ECOMM-06` / `F-BE-04` — likes & comments against real PostgreSQL through the full composition root. */
describe("likes & comments API", () => {
  const pool = getTestPool();
  const clock = new FakeClock("2026-11-17T10:00:00.000Z");
  let t: TestApp;
  let events: DomainEvent[] = [];
  let alice: AuthedUser;
  let bob: AuthedUser;
  let carol: AuthedUser;
  let post: PostRow;

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
    clock.set("2026-11-17T10:00:00.000Z");
    alice = await createAuthedUser(pool, { user: { username: "alice" } });
    bob = await createAuthedUser(pool, { user: { username: "bob" } });
    carol = await createAuthedUser(pool, { user: { username: "carol" } });
    ({ post } = await insertPostWithMedia(pool, { author_id: alice.user.id }));
    events = [];
  });
  afterAll(async () => {
    await t.close();
    await closeTestPool();
  });

  const pst = (id: string) => toPublicId("pst", id);
  const cmt = (id: string) => toPublicId("cmt", id);
  const usr = (id: string) => toPublicId("usr", id);
  const waitForEvents = () => new Promise((r) => setImmediate(r));
  const expectError = (res: { statusCode: number; json(): unknown }, status: number, code: string) => {
    expect(res.statusCode).toBe(status);
    expect(ErrorResponseDto.parse(res.json()).error.code).toBe(code);
  };
  const req = (
    method: "GET" | "PUT" | "POST" | "DELETE",
    url: string,
    who: AuthedUser | null,
    payload?: object,
  ) =>
    t.app.inject({
      method,
      url: `/api/v1${url}`,
      headers: who?.headers ?? {},
      ...(payload ? { payload } : {}),
    });
  const counters = async (postId = post.id) =>
    (
      await pool.query<{ like_count: number; comment_count: number }>(
        "SELECT like_count, comment_count FROM posts WHERE id = $1",
        [postId],
      )
    ).rows[0]!;
  const notifications = async () =>
    (
      await pool.query<{ type: string; recipient_id: string; actor_id: string; comment_id: string | null }>(
        "SELECT type, recipient_id, actor_id, comment_id FROM notifications ORDER BY created_at, id",
      )
    ).rows;
  const softDeletePost = () => pool.query("UPDATE posts SET deleted_at = now() WHERE id = $1", [post.id]);

  describe("PUT/DELETE /posts/{id}/like", () => {
    it("like → 200, like_count +1, one like notification for the author, events published", async () => {
      const res = await req("PUT", `/posts/${pst(post.id)}/like`, bob);
      expect(res.statusCode).toBe(200);
      expect(LikeStateResponseDto.parse(res.json())).toEqual({
        post_id: pst(post.id),
        liked: true,
        like_count: 1,
      });
      expect(await counters()).toEqual({ like_count: 1, comment_count: 0 });
      expect(await notifications()).toEqual([
        { type: "like", recipient_id: alice.user.id, actor_id: bob.user.id, comment_id: null },
      ]);
      await waitForEvents();
      expect(events.map((e) => e.type)).toEqual(["PostLiked", "NotificationCreated", "PostCountersChanged"]);
      expect(events[2]).toMatchObject({ authorId: alice.user.id, likeCount: 1, commentCount: 0 });
    });

    it("like is idempotent: repeat → same state, no extra count, notification or event", async () => {
      await req("PUT", `/posts/${pst(post.id)}/like`, bob);
      await waitForEvents();
      events = [];
      const res = await req("PUT", `/posts/${pst(post.id)}/like`, bob);
      expect(res.json()).toEqual({ post_id: pst(post.id), liked: true, like_count: 1 });
      expect(await counters()).toEqual({ like_count: 1, comment_count: 0 });
      expect(await notifications()).toHaveLength(1);
      await waitForEvents();
      expect(events).toEqual([]);
    });

    it("concurrent likes from different users keep like_count exact", async () => {
      const others = await Promise.all(
        Array.from({ length: 4 }, (_, i) => createAuthedUser(pool, { user: { username: `fan${i}` } })),
      );
      const results = await Promise.all(
        [bob, carol, ...others, bob].map((u) => req("PUT", `/posts/${pst(post.id)}/like`, u)),
      );
      expect(results.every((r) => r.statusCode === 200)).toBe(true);
      expect(await counters()).toEqual({ like_count: 6, comment_count: 0 });
      const { rows } = await pool.query("SELECT count(*)::int AS n FROM post_likes WHERE post_id = $1", [
        post.id,
      ]);
      expect(rows[0].n).toBe(6);
    });

    it("self-like counts but creates no notification", async () => {
      const res = await req("PUT", `/posts/${pst(post.id)}/like`, alice);
      expect(res.json()).toMatchObject({ liked: true, like_count: 1 });
      expect(await notifications()).toEqual([]);
      await waitForEvents();
      expect(events.map((e) => e.type)).toEqual(["PostLiked", "PostCountersChanged"]);
    });

    it("unlike → 200 liked=false, like_count -1, notification removed; repeat is a no-op", async () => {
      await req("PUT", `/posts/${pst(post.id)}/like`, bob);
      const res = await req("DELETE", `/posts/${pst(post.id)}/like`, bob);
      expect(LikeStateResponseDto.parse(res.json())).toEqual({
        post_id: pst(post.id),
        liked: false,
        like_count: 0,
      });
      expect(await notifications()).toEqual([]);
      const again = await req("DELETE", `/posts/${pst(post.id)}/like`, bob);
      expect(again.statusCode).toBe(200);
      expect(again.json()).toEqual({ post_id: pst(post.id), liked: false, like_count: 0 });
      expect(await counters()).toEqual({ like_count: 0, comment_count: 0 });
    });

    it("viewer_has_liked on GET /posts/{id} reflects the like", async () => {
      await req("PUT", `/posts/${pst(post.id)}/like`, bob);
      const res = await req("GET", `/posts/${pst(post.id)}`, bob);
      expect(res.json()).toMatchObject({ like_count: 1, viewer_has_liked: true });
    });

    it("401 without a token", async () => {
      expectError(await req("PUT", `/posts/${pst(post.id)}/like`, null), 401, "UNAUTHENTICATED");
      expectError(await req("DELETE", `/posts/${pst(post.id)}/like`, null), 401, "UNAUTHENTICATED");
    });

    it("404 for a soft-deleted or unknown post", async () => {
      await softDeletePost();
      expectError(await req("PUT", `/posts/${pst(post.id)}/like`, bob), 404, "NOT_FOUND");
      expectError(await req("DELETE", `/posts/${pst(post.id)}/like`, bob), 404, "NOT_FOUND");
      const unknown = pst("0190a000-0000-7000-8000-0000000000ff");
      expectError(await req("PUT", `/posts/${unknown}/like`, bob), 404, "NOT_FOUND");
    });

    it("400 for a malformed post id", async () => {
      expectError(await req("PUT", "/posts/usr_123/like", bob), 400, "VALIDATION_FAILED");
    });
  });

  describe("GET /posts/{id}/likes", () => {
    it("lists likers newest first with followed_at = like time, viewer follow flag, and keyset paging", async () => {
      await insertLike(pool, {
        post_id: post.id,
        user_id: bob.user.id,
        created_at: new Date("2026-11-17T09:00:00Z"),
      });
      await insertLike(pool, {
        post_id: post.id,
        user_id: carol.user.id,
        created_at: new Date("2026-11-17T09:30:00Z"),
      });
      await insertLike(pool, {
        post_id: post.id,
        user_id: alice.user.id,
        created_at: new Date("2026-11-17T09:45:00Z"),
      });
      await insertFollow(pool, { follower_id: alice.user.id, followee_id: carol.user.id });

      const first = await req("GET", `/posts/${pst(post.id)}/likes?limit=2`, alice);
      expect(first.statusCode).toBe(200);
      const p1 = UserSummaryPageResponseDto.parse(first.json());
      expect(p1.items.map((u) => [u.username, u.is_following, u.followed_at])).toEqual([
        ["alice", null, "2026-11-17T09:45:00.000Z"],
        ["carol", true, "2026-11-17T09:30:00.000Z"],
      ]);
      expect(p1.next_cursor).not.toBeNull();
      const p2 = UserSummaryPageResponseDto.parse(
        (await req("GET", `/posts/${pst(post.id)}/likes?limit=2&cursor=${p1.next_cursor}`, alice)).json(),
      );
      expect(p2.items.map((u) => [u.id, u.is_following])).toEqual([[usr(bob.user.id), false]]);
      expect(p2.next_cursor).toBeNull();
    });

    it("anonymous viewers get is_following null", async () => {
      await insertLike(pool, { post_id: post.id, user_id: bob.user.id });
      const res = await req("GET", `/posts/${pst(post.id)}/likes`, null);
      expect(res.json().items[0].is_following).toBeNull();
    });

    it("404 for a deleted post, 400 for a bad cursor", async () => {
      expectError(
        await req("GET", `/posts/${pst(post.id)}/likes?cursor=%%%`, null),
        400,
        "VALIDATION_FAILED",
      );
      await softDeletePost();
      expectError(await req("GET", `/posts/${pst(post.id)}/likes`, null), 404, "NOT_FOUND");
    });
  });

  describe("POST /posts/{id}/comments", () => {
    it("201 creates the comment (trimmed), comment_count +1, comment notification, events", async () => {
      const res = await req("POST", `/posts/${pst(post.id)}/comments`, bob, { text: "  great pic  " });
      expect(res.statusCode).toBe(201);
      const dto = CommentResponseDto.parse(res.json());
      expect(dto).toMatchObject({
        post_id: pst(post.id),
        text: "great pic",
        created_at: clock.now().toISOString(),
      });
      expect(dto.author).toMatchObject({ id: usr(bob.user.id), username: "bob", is_following: null });
      expect(await counters()).toEqual({ like_count: 0, comment_count: 1 });
      const [n] = await notifications();
      expect(n).toMatchObject({ type: "comment", recipient_id: alice.user.id, actor_id: bob.user.id });
      expect(cmt(n!.comment_id!)).toBe(dto.id);
      await waitForEvents();
      expect(events.map((e) => e.type)).toEqual([
        "CommentAdded",
        "NotificationCreated",
        "PostCountersChanged",
      ]);
    });

    it("self-comment creates no notification", async () => {
      const res = await req("POST", `/posts/${pst(post.id)}/comments`, alice, { text: "thanks all" });
      expect(res.statusCode).toBe(201);
      expect(await notifications()).toEqual([]);
      expect(await counters()).toEqual({ like_count: 0, comment_count: 1 });
    });

    it("accepts 500 chars; rejects empty, blank and 501 chars with 400", async () => {
      expect(
        (await req("POST", `/posts/${pst(post.id)}/comments`, bob, { text: "a".repeat(500) })).statusCode,
      ).toBe(201);
      for (const text of ["", "   ", "a".repeat(501)]) {
        expectError(
          await req("POST", `/posts/${pst(post.id)}/comments`, bob, { text }),
          400,
          "VALIDATION_FAILED",
        );
      }
      expect(await counters()).toEqual({ like_count: 0, comment_count: 1 });
    });

    it("401 without a token, 404 for a deleted post", async () => {
      expectError(
        await req("POST", `/posts/${pst(post.id)}/comments`, null, { text: "x" }),
        401,
        "UNAUTHENTICATED",
      );
      await softDeletePost();
      expectError(await req("POST", `/posts/${pst(post.id)}/comments`, bob, { text: "x" }), 404, "NOT_FOUND");
    });
  });

  describe("GET /posts/{id}/comments", () => {
    it("lists live comments oldest first with keyset paging", async () => {
      const c1 = await insertComment(pool, {
        post_id: post.id,
        author_id: bob.user.id,
        created_at: new Date("2026-11-17T09:00:00Z"),
      });
      const c2 = await insertComment(pool, {
        post_id: post.id,
        author_id: carol.user.id,
        created_at: new Date("2026-11-17T09:10:00Z"),
      });
      await insertComment(pool, {
        post_id: post.id,
        author_id: bob.user.id,
        created_at: new Date("2026-11-17T09:05:00Z"),
        deleted_at: new Date(),
      });
      const c3 = await insertComment(pool, {
        post_id: post.id,
        author_id: alice.user.id,
        created_at: new Date("2026-11-17T09:20:00Z"),
      });

      const p1 = CommentPageResponseDto.parse(
        (await req("GET", `/posts/${pst(post.id)}/comments?limit=2`, null)).json(),
      );
      expect(p1.items.map((c) => c.id)).toEqual([cmt(c1.id), cmt(c2.id)]);
      const p2 = CommentPageResponseDto.parse(
        (await req("GET", `/posts/${pst(post.id)}/comments?limit=2&cursor=${p1.next_cursor}`, null)).json(),
      );
      expect(p2.items.map((c) => c.id)).toEqual([cmt(c3.id)]);
      expect(p2.next_cursor).toBeNull();
    });

    it("404 for a deleted post", async () => {
      await softDeletePost();
      expectError(await req("GET", `/posts/${pst(post.id)}/comments`, null), 404, "NOT_FOUND");
    });
  });

  describe("DELETE /comments/{id} (INV-10)", () => {
    const addComment = async (who: AuthedUser) =>
      CommentResponseDto.parse(
        (await req("POST", `/posts/${pst(post.id)}/comments`, who, { text: "hey" })).json(),
      );

    it.each([
      ["comment author", () => bob],
      ["post author", () => alice],
    ])("%s → 204, soft delete, comment_count -1, notification kept", async (_l, who) => {
      const c = await addComment(bob);
      const res = await req("DELETE", `/comments/${c.id}`, who());
      expect(res.statusCode).toBe(204);
      expect(await counters()).toEqual({ like_count: 0, comment_count: 0 });
      const list = CommentPageResponseDto.parse(
        (await req("GET", `/posts/${pst(post.id)}/comments`, null)).json(),
      );
      expect(list.items).toEqual([]);
      expect(await notifications()).toHaveLength(1);
    });

    it("403 for a third user; 404 on second delete; 401 without a token", async () => {
      const c = await addComment(bob);
      expectError(await req("DELETE", `/comments/${c.id}`, carol), 403, "FORBIDDEN");
      expectError(await req("DELETE", `/comments/${c.id}`, null), 401, "UNAUTHENTICATED");
      expect((await req("DELETE", `/comments/${c.id}`, bob)).statusCode).toBe(204);
      expectError(await req("DELETE", `/comments/${c.id}`, bob), 404, "NOT_FOUND");
      expect(await counters()).toEqual({ like_count: 0, comment_count: 0 });
    });

    it("concurrent deletes of the same comment decrement comment_count once", async () => {
      const c = await addComment(bob);
      const results = await Promise.all([
        req("DELETE", `/comments/${c.id}`, bob),
        req("DELETE", `/comments/${c.id}`, alice),
      ]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([204, 404]);
      expect(await counters()).toEqual({ like_count: 0, comment_count: 0 });
    });

    it("400 for a malformed comment id", async () => {
      expectError(await req("DELETE", `/comments/${pst(post.id)}`, bob), 400, "VALIDATION_FAILED");
    });
  });
});
