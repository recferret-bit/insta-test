import { ErrorResponseDto, PostPageResponseDto, PostResponseDto, toPublicId } from "@insta/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { DomainEvent } from "../../../src/domain/shared/events.js";
import {
  buildTestApp,
  closeTestPool,
  createAuthedUser,
  FakeClock,
  getTestPool,
  insertFollow,
  insertLike,
  insertMedia,
  insertPostWithMedia,
  resetDb,
  truncateAll,
  type AuthedUser,
  type InsertMediaInput,
  type TestApp,
} from "../../helpers/index.js";

/** `F-ECOMM-05` / `F-BE-03` against real PostgreSQL through the full composition root. */
describe("posts API", () => {
  const pool = getTestPool();
  const clock = new FakeClock("2026-11-17T10:00:00.000Z");
  let t: TestApp;
  let events: DomainEvent[] = [];
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
    clock.set("2026-11-17T10:00:00.000Z");
    events = [];
    alice = await createAuthedUser(pool, { user: { username: "alice" } });
    bob = await createAuthedUser(pool, { user: { username: "bob" } });
  });
  afterAll(async () => {
    await t.close();
    await closeTestPool();
  });

  const expectError = (res: { statusCode: number; json(): unknown }, status: number, code: string) => {
    expect(res.statusCode).toBe(status);
    expect(ErrorResponseDto.parse(res.json()).error.code).toBe(code);
  };
  const med = (id: string) => toPublicId("med", id);
  const pst = (id: string) => toPublicId("pst", id);
  const uploaded = async (owner = alice, extra: Partial<InsertMediaInput> = {}) =>
    insertMedia(pool, { owner_id: owner.user.id, ...extra });
  const createPost = (body: unknown, who: AuthedUser | null = alice) =>
    t.app.inject({
      method: "POST",
      url: "/api/v1/posts",
      payload: body as object,
      headers: who?.headers ?? {},
    });
  const postsCount = async (userId: string) =>
    (await pool.query<{ posts_count: number }>("SELECT posts_count FROM users WHERE id = $1", [userId]))
      .rows[0]!.posts_count;
  const waitForEvents = () => new Promise((r) => setImmediate(r));

  describe("POST /posts", () => {
    it("201 creates the post in one tx: media attached in order, hashtags, posts_count, PostCreated", async () => {
      const m1 = await uploaded();
      const m2 = await uploaded(alice, { kind: "video", mime_type: "video/mp4" });
      const res = await createPost({
        caption: "  Hello #Sun #sun #Sea ",
        media_ids: [med(m2.id), med(m1.id)],
      });
      expect(res.statusCode).toBe(201);
      const dto = PostResponseDto.parse(res.json());
      expect(dto).toMatchObject({
        caption: "Hello #Sun #sun #Sea",
        hashtags: ["sun", "sea"],
        like_count: 0,
        comment_count: 0,
        viewer_has_liked: false,
        created_at: "2026-11-17T10:00:00.000Z",
        updated_at: "2026-11-17T10:00:00.000Z",
        author: { id: toPublicId("usr", alice.user.id), username: "alice", is_following: null },
      });
      expect(dto.media.map((m) => m.id)).toEqual([med(m2.id), med(m1.id)]);
      expect(dto.media[0]).toMatchObject({
        kind: "video",
        url: `http://localhost:18001/media/${m2.storage_key}`,
      });

      const { rows: media } = await pool.query(
        "SELECT id, status FROM media_assets WHERE id = ANY($1::uuid[]) ORDER BY id",
        [[m1.id, m2.id]],
      );
      expect(media.every((m) => m.status === "attached")).toBe(true);
      const { rows: tags } = await pool.query("SELECT tag, position FROM post_hashtags ORDER BY position");
      expect(tags).toEqual([
        { tag: "sun", position: 0 },
        { tag: "sea", position: 1 },
      ]);
      expect(await postsCount(alice.user.id)).toBe(1);
      await waitForEvents();
      expect(events).toEqual([expect.objectContaining({ type: "PostCreated", authorId: alice.user.id })]);
    });

    it("caption defaults to empty; 10 media is accepted", async () => {
      const ids = [];
      for (let i = 0; i < 10; i += 1) ids.push(med((await uploaded()).id));
      const res = await createPost({ media_ids: ids });
      expect(res.statusCode).toBe(201);
      expect(PostResponseDto.parse(res.json())).toMatchObject({ caption: "", hashtags: [] });
    });

    it("401 without a token", async () => {
      const m = await uploaded();
      expectError(await createPost({ media_ids: [med(m.id)] }, null), 401, "UNAUTHENTICATED");
    });

    it.each([
      ["no media", () => ({ media_ids: [] })],
      [
        "11 media",
        () => ({
          media_ids: Array.from({ length: 11 }, (_, i) => `med_${i.toString(16).padStart(32, "0")}`),
        }),
      ],
      ["duplicate media", () => ({ media_ids: [`med_${"1".repeat(32)}`, `med_${"1".repeat(32)}`] })],
      ["wrong id prefix", () => ({ media_ids: [`pst_${"1".repeat(32)}`] })],
      ["caption over 2200", () => ({ caption: "x".repeat(2201), media_ids: [`med_${"1".repeat(32)}`] })],
      ["unknown field", () => ({ media_ids: [`med_${"1".repeat(32)}`], extra: 1 })],
    ])("400 VALIDATION_FAILED for %s", async (_label, body) => {
      expectError(await createPost(body()), 400, "VALIDATION_FAILED");
    });

    it("400 for more than 30 hashtags (domain rule); nothing is written", async () => {
      const m = await uploaded();
      const caption = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
      expectError(await createPost({ caption, media_ids: [med(m.id)] }), 400, "VALIDATION_FAILED");
      expect((await pool.query("SELECT 1 FROM posts")).rowCount).toBe(0);
    });

    it.each([
      ["owned by another user", async () => uploaded(bob)],
      ["uploaded for a story", async () => uploaded(alice, { purpose: "story" })],
      ["already attached", async () => uploaded(alice, { status: "attached" })],
      ["missing", async () => ({ id: "0190a000-0000-7000-8000-0000000000ff" })],
    ])("422 MEDIA_INVALID when a media is %s; the tx rolls back", async (_label, arrange) => {
      const good = await uploaded();
      const bad = await arrange();
      expectError(await createPost({ media_ids: [med(good.id), med(bad.id)] }), 422, "MEDIA_INVALID");
      expect((await pool.query("SELECT 1 FROM posts")).rowCount).toBe(0);
      const { rows } = await pool.query("SELECT status FROM media_assets WHERE id = $1", [good.id]);
      expect(rows[0].status).toBe("uploaded");
      expect(await postsCount(alice.user.id)).toBe(0);
      await waitForEvents();
      expect(events).toEqual([]);
    });

    it("concurrent posts with the same media: exactly one succeeds", async () => {
      const m = await uploaded();
      const results = await Promise.all([
        createPost({ media_ids: [med(m.id)] }),
        createPost({ media_ids: [med(m.id)] }),
      ]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([201, 422]);
      expect(await postsCount(alice.user.id)).toBe(1);
    });
  });

  describe("GET /posts/{post_id}", () => {
    it("anonymous: viewer_has_liked false, is_following null; signed-in viewer sees like + follow state", async () => {
      const { post, media } = await insertPostWithMedia(pool, {
        author_id: alice.user.id,
        caption: "hi #a #b",
        hashtags: ["a", "b"],
        mediaCount: 3,
        like_count: 1,
      });
      await insertLike(pool, { post_id: post.id, user_id: bob.user.id });
      await insertFollow(pool, { follower_id: bob.user.id, followee_id: alice.user.id });

      const anon = await t.app.inject({ method: "GET", url: `/api/v1/posts/${pst(post.id)}` });
      expect(anon.statusCode).toBe(200);
      const a = PostResponseDto.parse(anon.json());
      expect(a).toMatchObject({
        viewer_has_liked: false,
        like_count: 1,
        hashtags: ["a", "b"],
        author: { is_following: null },
      });
      expect(a.media.map((m) => m.id)).toEqual(media.map((m) => med(m.id)));

      const asBob = await t.app.inject({
        method: "GET",
        url: `/api/v1/posts/${pst(post.id)}`,
        headers: bob.headers,
      });
      expect(PostResponseDto.parse(asBob.json())).toMatchObject({
        viewer_has_liked: true,
        author: { is_following: true },
      });

      const asAlice = await t.app.inject({
        method: "GET",
        url: `/api/v1/posts/${pst(post.id)}`,
        headers: alice.headers,
      });
      expect(PostResponseDto.parse(asAlice.json())).toMatchObject({
        viewer_has_liked: false,
        author: { is_following: null },
      });
    });

    it("an invalid token is treated as anonymous (auth optional)", async () => {
      const { post } = await insertPostWithMedia(pool, { author_id: alice.user.id });
      const res = await t.app.inject({
        method: "GET",
        url: `/api/v1/posts/${pst(post.id)}`,
        headers: { authorization: "Bearer nope" },
      });
      expect(res.statusCode).toBe(200);
    });

    it("404 for unknown or soft-deleted posts; 400 for a malformed id", async () => {
      const { post } = await insertPostWithMedia(pool, { author_id: alice.user.id, deleted_at: new Date() });
      expectError(
        await t.app.inject({ method: "GET", url: `/api/v1/posts/${pst(post.id)}` }),
        404,
        "NOT_FOUND",
      );
      expectError(
        await t.app.inject({ method: "GET", url: `/api/v1/posts/pst_${"0".repeat(32)}` }),
        404,
        "NOT_FOUND",
      );
      expectError(await t.app.inject({ method: "GET", url: "/api/v1/posts/abc" }), 400, "VALIDATION_FAILED");
    });
  });

  describe("PATCH /posts/{post_id}", () => {
    const patch = (postId: string, body: unknown, who: AuthedUser | null = alice) =>
      t.app.inject({
        method: "PATCH",
        url: `/api/v1/posts/${pst(postId)}`,
        payload: body as object,
        headers: who?.headers ?? {},
      });

    it("200 replaces caption + hashtags and bumps updated_at; media unchanged", async () => {
      const { post, media } = await insertPostWithMedia(pool, {
        author_id: alice.user.id,
        caption: "old #old",
        hashtags: ["old"],
        created_at: new Date("2026-11-17T09:00:00.000Z"),
        updated_at: new Date("2026-11-17T09:00:00.000Z"),
      });
      const res = await patch(post.id, { caption: "#New and #more" });
      expect(res.statusCode).toBe(200);
      const dto = PostResponseDto.parse(res.json());
      expect(dto).toMatchObject({
        caption: "#New and #more",
        hashtags: ["new", "more"],
        created_at: "2026-11-17T09:00:00.000Z",
        updated_at: "2026-11-17T10:00:00.000Z",
      });
      expect(dto.media.map((m) => m.id)).toEqual([med(media[0]!.id)]);
      const { rows } = await pool.query(
        "SELECT tag FROM post_hashtags WHERE post_id = $1 ORDER BY position",
        [post.id],
      );
      expect(rows.map((r) => r.tag)).toEqual(["new", "more"]);
    });

    it("403 for a non-author, 404 for a deleted post, 401 anonymous, 400 over-long caption", async () => {
      const { post } = await insertPostWithMedia(pool, { author_id: alice.user.id, caption: "keep" });
      expectError(await patch(post.id, { caption: "x" }, bob), 403, "FORBIDDEN");
      expectError(await patch(post.id, { caption: "x" }, null), 401, "UNAUTHENTICATED");
      expectError(await patch(post.id, { caption: "x".repeat(2201) }), 400, "VALIDATION_FAILED");
      expectError(await patch(post.id, {}), 400, "VALIDATION_FAILED");
      const { rows } = await pool.query("SELECT caption FROM posts WHERE id = $1", [post.id]);
      expect(rows[0].caption).toBe("keep");
      await pool.query("UPDATE posts SET deleted_at = now() WHERE id = $1", [post.id]);
      expectError(await patch(post.id, { caption: "x" }), 404, "NOT_FOUND");
    });
  });

  describe("DELETE /posts/{post_id}", () => {
    const del = (postId: string, who: AuthedUser | null = alice) =>
      t.app.inject({ method: "DELETE", url: `/api/v1/posts/${pst(postId)}`, headers: who?.headers ?? {} });

    it("204 soft-deletes, decrements posts_count once, emits PostDeleted; then 404", async () => {
      const { post } = await insertPostWithMedia(pool, { author_id: alice.user.id });
      expect(await postsCount(alice.user.id)).toBe(1);
      const res = await del(post.id);
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe("");
      const { rows } = await pool.query("SELECT deleted_at FROM posts WHERE id = $1", [post.id]);
      expect(rows[0].deleted_at).toEqual(new Date("2026-11-17T10:00:00.000Z"));
      expect(await postsCount(alice.user.id)).toBe(0);
      await waitForEvents();
      expect(events).toEqual([
        { type: "PostDeleted", postId: post.id, authorId: alice.user.id, at: clock.now() },
      ]);
      expectError(await del(post.id), 404, "NOT_FOUND");
      expect(await postsCount(alice.user.id)).toBe(0);
      expectError(
        await t.app.inject({ method: "GET", url: `/api/v1/posts/${pst(post.id)}` }),
        404,
        "NOT_FOUND",
      );
    });

    it("concurrent deletes decrement posts_count exactly once", async () => {
      const { post } = await insertPostWithMedia(pool, { author_id: alice.user.id });
      const results = await Promise.all([del(post.id), del(post.id), del(post.id)]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([204, 404, 404]);
      expect(await postsCount(alice.user.id)).toBe(0);
    });

    it("403 for a non-author, 401 anonymous", async () => {
      const { post } = await insertPostWithMedia(pool, { author_id: alice.user.id });
      expectError(await del(post.id, bob), 403, "FORBIDDEN");
      expectError(await del(post.id, null), 401, "UNAUTHENTICATED");
      expect(await postsCount(alice.user.id)).toBe(1);
    });
  });

  describe("GET /users/{username}/posts", () => {
    const list = (path: string, who: AuthedUser | null = null) =>
      t.app.inject({ method: "GET", url: `/api/v1/users/${path}`, headers: who?.headers ?? {} });

    it("pages created_at DESC, id DESC with keyset cursors; excludes deleted and other authors", async () => {
      const at = (min: number) => new Date(Date.UTC(2026, 10, 17, 9, min));
      const ids: string[] = [];
      for (const min of [1, 2, 3, 3, 4]) {
        ids.push(
          (await insertPostWithMedia(pool, { author_id: alice.user.id, created_at: at(min) })).post.id,
        );
      }
      await insertPostWithMedia(pool, { author_id: alice.user.id, created_at: at(5), deleted_at: at(6) });
      await insertPostWithMedia(pool, { author_id: bob.user.id, created_at: at(5) });
      const tie = [ids[2]!, ids[3]!].sort().reverse();
      const expected = [ids[4]!, ...tie, ids[1]!, ids[0]!].map(pst);

      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const qs: string = cursor ? `?limit=2&cursor=${cursor}` : "?limit=2";
        const res = await list(`Alice/posts${qs}`, bob);
        expect(res.statusCode).toBe(200);
        const page = PostPageResponseDto.parse(res.json());
        seen.push(...page.items.map((p) => p.id));
        cursor = page.next_cursor;
        pages += 1;
      } while (cursor && pages < 10);
      expect(seen).toEqual(expected);
      expect(pages).toBe(3);
    });

    it("hydrates media, hashtags and viewer_has_liked per post", async () => {
      const a = await insertPostWithMedia(pool, {
        author_id: alice.user.id,
        mediaCount: 2,
        hashtags: ["x"],
        created_at: new Date("2026-11-17T09:00:00.000Z"),
      });
      const b = await insertPostWithMedia(pool, {
        author_id: alice.user.id,
        created_at: new Date("2026-11-17T09:30:00.000Z"),
      });
      await insertLike(pool, { post_id: a.post.id, user_id: bob.user.id });
      const page = PostPageResponseDto.parse((await list("alice/posts", bob)).json());
      expect(page.next_cursor).toBeNull();
      expect(page.items.map((p) => [p.id, p.viewer_has_liked, p.media.length, p.hashtags])).toEqual([
        [pst(b.post.id), false, 1, []],
        [pst(a.post.id), true, 2, ["x"]],
      ]);
    });

    it("empty page for a user without posts; 404 unknown user; 400 bad cursor / limit", async () => {
      expect(PostPageResponseDto.parse((await list("bob/posts")).json())).toEqual({
        items: [],
        next_cursor: null,
      });
      expectError(await list("nobody/posts"), 404, "NOT_FOUND");
      expectError(await list("alice/posts?cursor=%21%21"), 400, "VALIDATION_FAILED");
      expectError(await list("alice/posts?cursor=eyJ0IjoxfQ"), 400, "VALIDATION_FAILED");
      expectError(await list("alice/posts?limit=0"), 400, "VALIDATION_FAILED");
      expectError(await list("alice/posts?limit=51"), 400, "VALIDATION_FAILED");
      expect((await list("alice/posts?limit=50")).statusCode).toBe(200);
    });
  });

  describe("end-to-end through the API", () => {
    it("create → list → edit → delete keeps posts_count consistent", async () => {
      const m = await uploaded();
      const created = PostResponseDto.parse(
        (await createPost({ caption: "first", media_ids: [med(m.id)] })).json(),
      );
      const listed = PostPageResponseDto.parse(
        (await t.app.inject({ method: "GET", url: "/api/v1/users/alice/posts" })).json(),
      );
      expect(listed.items.map((p) => p.id)).toEqual([created.id]);
      clock.advance(1000);
      const edited = await t.app.inject({
        method: "PATCH",
        url: `/api/v1/posts/${created.id}`,
        payload: { caption: "second #two" },
        headers: alice.headers,
      });
      expect(PostResponseDto.parse(edited.json())).toMatchObject({
        caption: "second #two",
        hashtags: ["two"],
      });
      const del = await t.app.inject({
        method: "DELETE",
        url: `/api/v1/posts/${created.id}`,
        headers: alice.headers,
      });
      expect(del.statusCode).toBe(204);
      expect(await postsCount(alice.user.id)).toBe(0);
    });
  });
});
