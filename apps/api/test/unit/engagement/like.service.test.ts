import { beforeEach, describe, expect, it } from "vitest";

import { LikeService } from "../../../src/domain/posts/like.service.js";
import type { MediaId, PostId, UserId } from "../../../src/domain/shared/ids.js";
import { FakeClock } from "../../helpers/clock.js";
import { SeqIds } from "../identity/fakes.js";
import { FakePosts, RecordingUow } from "../posts/fakes.js";
import { FakeLikes, FakeNotifications, samplePost } from "./fakes.js";

const ALICE = "0190a000-0000-7000-8000-00000000a11c" as UserId;
const BOB = "0190a000-0000-7000-8000-000000000b0b" as UserId;
const POST = "0190a000-0000-7000-a000-000000000001" as PostId;
const MISSING = "0190a000-0000-7000-a000-0000000000ff" as PostId;

describe("LikeService (F-BE-04)", () => {
  let posts: FakePosts;
  let likes: FakeLikes;
  let notifications: FakeNotifications;
  let uow: RecordingUow;
  let clock: FakeClock;
  let service: LikeService;

  beforeEach(() => {
    posts = new FakePosts({ rows: new Map<MediaId, never>() });
    posts.rows.set(POST, samplePost(POST, ALICE, { likes: 3 }));
    likes = new FakeLikes();
    notifications = new FakeNotifications();
    uow = new RecordingUow([posts, likes, notifications]);
    clock = new FakeClock("2026-11-17T10:00:00.000Z");
    service = new LikeService({ likes, posts, notifications, uow, clock, ids: new SeqIds() });
  });

  describe("like", () => {
    it("inserts the like, bumps like_count, notifies the author and emits events in order", async () => {
      const state = await service.like(POST, BOB);
      expect(state).toEqual({ postId: POST, liked: true, likeCount: 4 });
      expect(posts.rows.get(POST)!.likeCount).toBe(4);
      expect(likes.rows.get(`${POST}:${BOB}`)).toEqual({ postId: POST, userId: BOB, createdAt: clock.now() });
      const [n] = [...notifications.rows.values()];
      expect(n).toMatchObject({
        type: "like",
        recipientId: ALICE,
        actorId: BOB,
        postId: POST,
        commentId: null,
      });
      expect(uow.published).toEqual([
        { type: "PostLiked", postId: POST, userId: BOB, at: clock.now() },
        { type: "NotificationCreated", notificationId: n!.id, recipientId: ALICE },
        { type: "PostCountersChanged", postId: POST, authorId: ALICE, likeCount: 4, commentCount: 0 },
      ]);
    });

    it("is idempotent: a second like changes nothing and emits nothing", async () => {
      await service.like(POST, BOB);
      uow.published = [];
      const state = await service.like(POST, BOB);
      expect(state).toEqual({ postId: POST, liked: true, likeCount: 4 });
      expect(posts.rows.get(POST)!.likeCount).toBe(4);
      expect(notifications.rows.size).toBe(1);
      expect(uow.published).toEqual([]);
    });

    it("self-like counts but creates no notification (INV-08)", async () => {
      const state = await service.like(POST, ALICE);
      expect(state.likeCount).toBe(4);
      expect(notifications.rows.size).toBe(0);
      expect(uow.published.map((e) => e.type)).toEqual(["PostLiked", "PostCountersChanged"]);
    });

    it("does not emit NotificationCreated when the notification already existed", async () => {
      await service.like(POST, BOB);
      likes.rows.clear(); // like gone but notification left behind (dedupe index hit)
      uow.published = [];
      await service.like(POST, BOB);
      expect(uow.published.map((e) => e.type)).toEqual(["PostLiked", "PostCountersChanged"]);
    });

    it("locks the post inside the transaction", async () => {
      await service.like(POST, BOB);
      expect(posts.findLiveTx[0]).toBeDefined();
    });

    it.each([
      ["missing", MISSING],
      ["soft-deleted", POST],
    ])("NOT_FOUND for a %s post, nothing written", async (label, id) => {
      if (label === "soft-deleted") posts.rows.get(POST)!.deletedAt = clock.now();
      await expect(service.like(id, BOB)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(likes.rows.size).toBe(0);
      expect(uow.published).toEqual([]);
    });
  });

  describe("unlike", () => {
    it("removes the like, decrements like_count, deletes the notification, emits PostCountersChanged", async () => {
      await service.like(POST, BOB);
      uow.published = [];
      const state = await service.unlike(POST, BOB);
      expect(state).toEqual({ postId: POST, liked: false, likeCount: 3 });
      expect(likes.rows.size).toBe(0);
      expect(notifications.rows.size).toBe(0);
      expect(uow.published).toEqual([
        { type: "PostCountersChanged", postId: POST, authorId: ALICE, likeCount: 3, commentCount: 0 },
      ]);
    });

    it("is idempotent: unliking a post that was not liked returns liked=false unchanged", async () => {
      const state = await service.unlike(POST, BOB);
      expect(state).toEqual({ postId: POST, liked: false, likeCount: 3 });
      expect(posts.rows.get(POST)!.likeCount).toBe(3);
      expect(uow.published).toEqual([]);
    });

    it("NOT_FOUND for a missing post", async () => {
      await expect(service.unlike(MISSING, BOB)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("listLikers", () => {
    it("delegates to the repository with viewer and page", async () => {
      await service.like(POST, BOB);
      const page = { cursor: null, limit: 5 };
      const result = await service.listLikers(POST, ALICE, page);
      expect(result.items.map((u) => u.id)).toEqual([BOB]);
      expect(result.items[0]!.relationAt).toEqual(clock.now());
      expect(likes.listCalls).toEqual([{ postId: POST, viewerId: ALICE, page }]);
    });

    it("NOT_FOUND for a soft-deleted post", async () => {
      posts.rows.get(POST)!.deletedAt = clock.now();
      await expect(service.listLikers(POST, null, { cursor: null, limit: 5 })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(likes.listCalls).toEqual([]);
    });
  });
});
