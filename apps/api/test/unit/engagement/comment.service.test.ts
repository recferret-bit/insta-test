import { beforeEach, describe, expect, it } from "vitest";

import { CommentService } from "../../../src/domain/posts/comment.service.js";
import type { CommentId, MediaId, PostId, UserId } from "../../../src/domain/shared/ids.js";
import { FakeClock } from "../../helpers/clock.js";
import { SeqIds } from "../identity/fakes.js";
import { FakePosts, RecordingUow } from "../posts/fakes.js";
import { FakeComments, FakeNotifications, samplePost } from "./fakes.js";

const ALICE = "0190a000-0000-7000-8000-00000000a11c" as UserId;
const BOB = "0190a000-0000-7000-8000-000000000b0b" as UserId;
const CAROL = "0190a000-0000-7000-8000-000000000ca1" as UserId;
const POST = "0190a000-0000-7000-a000-000000000001" as PostId;
const MISSING = "0190a000-0000-7000-a000-0000000000ff" as PostId;

describe("CommentService (F-BE-04)", () => {
  let posts: FakePosts;
  let comments: FakeComments;
  let notifications: FakeNotifications;
  let uow: RecordingUow;
  let clock: FakeClock;
  let service: CommentService;

  beforeEach(() => {
    posts = new FakePosts({ rows: new Map<MediaId, never>() });
    posts.rows.set(POST, samplePost(POST, ALICE, { likes: 2, comments: 1 }));
    comments = new FakeComments();
    notifications = new FakeNotifications();
    uow = new RecordingUow([posts, comments, notifications]);
    clock = new FakeClock("2026-11-17T10:00:00.000Z");
    service = new CommentService({ comments, posts, notifications, uow, clock, ids: new SeqIds() });
  });

  const add = (text = "  nice shot  ", authorId = BOB, postId = POST) =>
    service.addComment({ postId, authorId, text });

  describe("addComment", () => {
    it("inserts trimmed text, bumps comment_count, notifies the post author, emits events", async () => {
      const view = await add();
      expect(view).toMatchObject({ postId: POST, text: "nice shot", createdAt: clock.now() });
      expect(view.author.id).toBe(BOB);
      expect(posts.rows.get(POST)!.commentCount).toBe(2);
      const [n] = [...notifications.rows.values()];
      expect(n).toMatchObject({
        type: "comment",
        recipientId: ALICE,
        actorId: BOB,
        postId: POST,
        commentId: view.id,
      });
      expect(uow.published).toEqual([
        { type: "CommentAdded", commentId: view.id, postId: POST, authorId: BOB, at: clock.now() },
        { type: "NotificationCreated", notificationId: n!.id, recipientId: ALICE },
        { type: "PostCountersChanged", postId: POST, authorId: ALICE, likeCount: 2, commentCount: 2 },
      ]);
    });

    it("self-comment creates no notification (INV-08)", async () => {
      await add("mine", ALICE);
      expect(notifications.rows.size).toBe(0);
      expect(uow.published.map((e) => e.type)).toEqual(["CommentAdded", "PostCountersChanged"]);
    });

    it("every comment notifies (no dedupe)", async () => {
      await add("one");
      await add("two");
      expect(notifications.rows.size).toBe(2);
    });

    it("accepts exactly 500 characters (code points)", async () => {
      const view = await add("😀".repeat(500));
      expect(Array.from(view.text)).toHaveLength(500);
    });

    it.each([
      ["empty", ""],
      ["blank", "   "],
      ["501 chars", "a".repeat(501)],
    ])("VALIDATION_FAILED for %s text without opening a transaction", async (_l, text) => {
      await expect(add(text)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
      expect(uow.runs).toBe(0);
    });

    it("NOT_FOUND for a missing or deleted post; nothing written", async () => {
      await expect(add("x", BOB, MISSING)).rejects.toMatchObject({ code: "NOT_FOUND" });
      posts.rows.get(POST)!.deletedAt = clock.now();
      await expect(add("x")).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(comments.rows.size).toBe(0);
      expect(uow.published).toEqual([]);
    });
  });

  describe("deleteComment (INV-10)", () => {
    let commentId: CommentId;
    beforeEach(async () => {
      commentId = (await add("hello", BOB)).id;
      uow.published = [];
    });

    it.each([
      ["comment author", BOB],
      ["post author", ALICE],
    ])("%s can delete: soft delete, comment_count -1, PostCountersChanged", async (_l, actor) => {
      await service.deleteComment(commentId, actor);
      expect(comments.rows.get(commentId)!.deletedAt).toEqual(clock.now());
      expect(posts.rows.get(POST)!.commentCount).toBe(1);
      expect(uow.published).toEqual([
        { type: "PostCountersChanged", postId: POST, authorId: ALICE, likeCount: 2, commentCount: 1 },
      ]);
      // The comment notification is kept (hidden by the notification list query).
      expect(notifications.rows.size).toBe(1);
    });

    it("FORBIDDEN for anyone else; nothing changes", async () => {
      await expect(service.deleteComment(commentId, CAROL)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(comments.rows.get(commentId)!.deletedAt).toBeNull();
      expect(posts.rows.get(POST)!.commentCount).toBe(2);
      expect(uow.published).toEqual([]);
    });

    it("NOT_FOUND when deleted twice (counter decremented once)", async () => {
      await service.deleteComment(commentId, BOB);
      await expect(service.deleteComment(commentId, BOB)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(posts.rows.get(POST)!.commentCount).toBe(1);
    });

    it("NOT_FOUND for an unknown comment", async () => {
      await expect(
        service.deleteComment("0190a000-0000-7000-b000-000000000000" as CommentId, BOB),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("NOT_FOUND when the post was soft-deleted", async () => {
      posts.rows.get(POST)!.deletedAt = clock.now();
      await expect(service.deleteComment(commentId, ALICE)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("locks the comment inside the transaction", async () => {
      await service.deleteComment(commentId, BOB);
      expect(comments.findLiveTx[0]).toBeDefined();
    });
  });

  describe("listComments", () => {
    it("delegates to the repository and hides deleted comments", async () => {
      const a = await add("a");
      const b = await add("b");
      await service.deleteComment(a.id, BOB);
      const page = { cursor: null, limit: 10 };
      const result = await service.listComments(POST, page);
      expect(result.items.map((c) => c.id)).toEqual([b.id]);
      expect(comments.listCalls).toEqual([{ postId: POST, page }]);
    });

    it("NOT_FOUND for a missing post", async () => {
      await expect(service.listComments(MISSING, { cursor: null, limit: 10 })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });
});
