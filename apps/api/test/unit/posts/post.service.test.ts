import { beforeEach, describe, expect, it } from "vitest";

import type { UserCounterDelta } from "../../../src/domain/identity/ports.js";
import type { Hashtag, Post } from "../../../src/domain/posts/post.entity.js";
import { PostService } from "../../../src/domain/posts/post.service.js";
import type { MediaId, PostId, UserId } from "../../../src/domain/shared/ids.js";
import type { Tx } from "../../../src/domain/shared/unit-of-work.js";
import { FakeClock } from "../../helpers/clock.js";
import { FakeMedia, FakeUsers, SeqIds } from "../identity/fakes.js";
import { FakePosts, RecordingUow, sampleMedia, sampleUser } from "./fakes.js";

const ALICE = "0190a000-0000-7000-8000-00000000a11c" as UserId;
const BOB = "0190a000-0000-7000-8000-000000000b0b" as UserId;
const mediaId = (n: number) => `0190a000-0000-7000-9000-${n.toString(16).padStart(12, "0")}` as MediaId;

class CountingUsers extends FakeUsers {
  counterCalls: { id: UserId; delta: UserCounterDelta }[] = [];
  override async adjustCounters(id: UserId, delta: UserCounterDelta, _tx: Tx): Promise<void> {
    this.counterCalls.push({ id, delta });
  }
}

describe("PostService (F-BE-03)", () => {
  let users: CountingUsers;
  let media: FakeMedia;
  let posts: FakePosts;
  let uow: RecordingUow;
  let clock: FakeClock;
  let service: PostService;

  beforeEach(() => {
    users = new CountingUsers();
    users.rows.set(ALICE, sampleUser(ALICE, "alice"));
    users.rows.set(BOB, sampleUser(BOB, "bob"));
    media = new FakeMedia();
    for (let n = 1; n <= 11; n += 1) media.rows.set(mediaId(n), sampleMedia(mediaId(n), ALICE));
    posts = new FakePosts(media);
    uow = new RecordingUow([posts, media]);
    clock = new FakeClock("2026-11-17T10:00:00.000Z");
    service = new PostService({ posts, media, users, uow, clock, ids: new SeqIds() });
  });

  const create = (mediaIds: MediaId[], caption = "") =>
    service.createPost({ authorId: ALICE, caption, mediaIds });

  describe("createPost", () => {
    it("inserts the post, attaches media in order, bumps posts_count and emits PostCreated", async () => {
      const view = await create([mediaId(2), mediaId(1)], "  Sunset #Beach #beach #sky  ");
      expect(view.caption).toBe("Sunset #Beach #beach #sky");
      expect(view.hashtags).toEqual(["beach", "sky"]);
      expect(view.media.map((m) => m.id)).toEqual([mediaId(2), mediaId(1)]);
      expect(view.likeCount).toBe(0);
      expect(view.viewerHasLiked).toBe(false);
      expect(view.createdAt).toEqual(clock.now());
      const stored = posts.rows.get(view.id)!;
      expect(stored.media).toEqual([
        { mediaId: mediaId(2), position: 0 },
        { mediaId: mediaId(1), position: 1 },
      ]);
      expect(media.rows.get(mediaId(1))!.status).toBe("attached");
      expect(media.rows.get(mediaId(2))!.status).toBe("attached");
      expect(users.counterCalls).toEqual([{ id: ALICE, delta: { posts: 1 } }]);
      expect(uow.published).toEqual([
        { type: "PostCreated", postId: view.id, authorId: ALICE, at: clock.now() },
      ]);
    });

    it("accepts exactly 10 media (upper boundary)", async () => {
      const ids = Array.from({ length: 10 }, (_, i) => mediaId(i + 1));
      const view = await create(ids);
      expect(view.media).toHaveLength(10);
    });

    it.each([
      ["no media", [] as number[]],
      ["11 media", Array.from({ length: 11 }, (_, i) => i + 1)],
      ["duplicate media", [1, 1]],
    ])("VALIDATION_FAILED for %s without opening a transaction", async (_label, ns) => {
      await expect(create(ns.map(mediaId))).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
      expect(uow.runs).toBe(0);
    });

    it("VALIDATION_FAILED for a caption over 2200 chars or more than 30 hashtags", async () => {
      await expect(create([mediaId(1)], "x".repeat(2201))).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
      });
      const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
      await expect(create([mediaId(1)], tags)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    });

    it.each([
      ["missing", () => media.rows.delete(mediaId(1))],
      ["owned by someone else", () => media.rows.set(mediaId(1), sampleMedia(mediaId(1), BOB))],
      [
        "uploaded for a story",
        () => media.rows.set(mediaId(1), sampleMedia(mediaId(1), ALICE, { purpose: "story" })),
      ],
      [
        "already attached",
        () => media.rows.set(mediaId(1), sampleMedia(mediaId(1), ALICE, { status: "attached" })),
      ],
    ])("MEDIA_INVALID when one media is %s, and nothing is written", async (_label, arrange) => {
      arrange();
      await expect(create([mediaId(2), mediaId(1)])).rejects.toMatchObject({ code: "MEDIA_INVALID" });
      expect(posts.rows.size).toBe(0);
      expect(media.rows.get(mediaId(2))!.status).toBe("uploaded");
      expect(users.counterCalls).toEqual([]);
      expect(uow.published).toEqual([]);
    });

    it("accepts a video media item", async () => {
      media.rows.set(
        mediaId(3),
        sampleMedia(mediaId(3), ALICE, { kind: "video", mimeType: "video/mp4", durationMs: 5000 }),
      );
      const view = await create([mediaId(3)]);
      expect(view.media[0]!.kind).toBe("video");
    });
  });

  describe("editCaption", () => {
    let post: Post;
    beforeEach(async () => {
      const view = await create([mediaId(1)], "old #a");
      post = posts.rows.get(view.id)!;
      clock.advance(60_000);
      uow.published = [];
    });

    it("replaces caption + hashtags, bumps updated_at, keeps media and counters", async () => {
      const view = await service.editCaption({ postId: post.id, actorId: ALICE, caption: " new #B #c " });
      expect(view.caption).toBe("new #B #c");
      expect(view.hashtags).toEqual(["b", "c"] as Hashtag[]);
      expect(view.updatedAt).toEqual(clock.now());
      expect(view.createdAt).toEqual(post.createdAt);
      expect(view.media.map((m) => m.id)).toEqual([mediaId(1)]);
      expect(uow.published).toEqual([]);
      expect(posts.findLiveTx[posts.findLiveTx.length - 1]).toBeDefined();
    });

    it("allows clearing the caption (0 chars)", async () => {
      const view = await service.editCaption({ postId: post.id, actorId: ALICE, caption: "" });
      expect(view.caption).toBe("");
      expect(view.hashtags).toEqual([]);
    });

    it("FORBIDDEN for a non-author; NOT_FOUND for missing or deleted posts", async () => {
      await expect(
        service.editCaption({ postId: post.id, actorId: BOB, caption: "x" }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      const missing = "0190a000-0000-7000-8000-ffffffffffff" as PostId;
      await expect(
        service.editCaption({ postId: missing, actorId: ALICE, caption: "x" }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await service.deletePost(post.id, ALICE);
      await expect(
        service.editCaption({ postId: post.id, actorId: ALICE, caption: "x" }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("VALIDATION_FAILED for an over-long caption; the stored caption is unchanged", async () => {
      await expect(
        service.editCaption({ postId: post.id, actorId: ALICE, caption: "y".repeat(2201) }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
      expect(posts.rows.get(post.id)!.caption).toBe("old #a");
    });
  });

  describe("deletePost", () => {
    let postId: PostId;
    beforeEach(async () => {
      postId = (await create([mediaId(1)])).id;
      users.counterCalls = [];
      uow.published = [];
    });

    it("soft-deletes, decrements posts_count and emits PostDeleted", async () => {
      await service.deletePost(postId, ALICE);
      expect(posts.rows.get(postId)!.deletedAt).toEqual(clock.now());
      expect(users.counterCalls).toEqual([{ id: ALICE, delta: { posts: -1 } }]);
      expect(uow.published).toEqual([{ type: "PostDeleted", postId, authorId: ALICE, at: clock.now() }]);
      await expect(service.getPost(postId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("FORBIDDEN for a non-author (nothing changes)", async () => {
      await expect(service.deletePost(postId, BOB)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(posts.rows.get(postId)!.deletedAt).toBeNull();
      expect(users.counterCalls).toEqual([]);
      expect(uow.published).toEqual([]);
    });

    it("NOT_FOUND on a second delete (counter decremented once)", async () => {
      await service.deletePost(postId, ALICE);
      await expect(service.deletePost(postId, ALICE)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(users.counterCalls).toHaveLength(1);
    });
  });

  describe("reads", () => {
    it("getPost returns viewer-specific views; NOT_FOUND for unknown ids", async () => {
      const { id } = await create([mediaId(1)]);
      posts.likedBy.add(`${BOB}:${id}`);
      expect((await service.getPost(id, BOB)).viewerHasLiked).toBe(true);
      expect((await service.getPost(id)).viewerHasLiked).toBe(false);
      await expect(service.getPost("0190a000-0000-7000-8000-ffffffffffff" as PostId)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("listUserPosts resolves the username case-insensitively and passes the page through", async () => {
      await create([mediaId(1)]);
      const page = { cursor: null, limit: 5 };
      const result = await service.listUserPosts("  ALICE ", BOB, page);
      expect(result.items).toHaveLength(1);
      expect(posts.listCalls).toEqual([{ authorId: ALICE, viewerId: BOB, page }]);
    });

    it("listUserPosts → NOT_FOUND for an unknown username", async () => {
      await expect(service.listUserPosts("nobody", null, { cursor: null, limit: 20 })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });
});
