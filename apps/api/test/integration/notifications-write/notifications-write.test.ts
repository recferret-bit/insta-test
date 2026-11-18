import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PgUnitOfWork } from "../../../src/data/db/tx.js";
import { PgNotificationRepository } from "../../../src/data/repositories/notifications.pg-repository.js";
import type { NotificationRow } from "../../../src/data/rows/notifications.row.js";
import {
  Notification,
  type CreateNotificationInput,
  type NotificationUndoKey,
} from "../../../src/domain/notifications/notification.entity.js";
import type { CommentId, NotificationId, PostId, UserId } from "../../../src/domain/shared/ids.js";
import {
  closeTestPool,
  getTestPool,
  insertComment,
  insertNotification,
  insertPost,
  insertUser,
  resetDb,
  truncateAll,
} from "../../helpers/index.js";

/** F-BE-08 write side: `insertIfAbsent` dedupe (`notifications_like_uq` / `_follow_uq`) and `deleteFor` undo. */
describe("PgNotificationRepository (write side) + PostgreSQL", () => {
  const pool = getTestPool();
  const repo = new PgNotificationRepository(pool);
  const uow = new PgUnitOfWork(pool, { publish: () => undefined });
  const now = new Date("2026-11-18T12:00:00.000Z");

  let alice: UserId;
  let bob: UserId;
  let carol: UserId;
  let post: PostId;

  beforeAll(async () => {
    await resetDb(pool);
  });
  beforeEach(async () => {
    await truncateAll(pool);
    alice = (await insertUser(pool)).id as UserId;
    bob = (await insertUser(pool)).id as UserId;
    carol = (await insertUser(pool)).id as UserId;
    post = (await insertPost(pool, { author_id: alice })).id as PostId;
  });
  afterAll(async () => {
    await closeTestPool();
  });

  type Target = Omit<CreateNotificationInput, "id" | "now">;
  function build(target: Target, id: string = uuidv7()): Notification {
    const n = Notification.create({ ...target, id: id as NotificationId, now } as CreateNotificationInput);
    if (!n) throw new Error("test built a self-notification");
    return n;
  }
  const insert = (n: Notification) => uow.run((tx) => repo.insertIfAbsent(n, tx));
  const undo = (key: NotificationUndoKey) => uow.run((tx) => repo.deleteFor(key, tx));
  const likeBy = (actorId: UserId, postId: PostId = post): Target => ({
    type: "like",
    recipientId: alice,
    actorId,
    postId,
  });
  const followOf = (actorId: UserId, recipientId: UserId): Target => ({
    type: "follow",
    recipientId,
    actorId,
  });

  async function rows(): Promise<NotificationRow[]> {
    const { rows: all } = await pool.query<NotificationRow>(
      "SELECT * FROM notifications ORDER BY created_at, id",
    );
    return all;
  }

  describe("insertIfAbsent", () => {
    it("inserts a like notification and maps every column", async () => {
      const n = build(likeBy(bob));
      await expect(insert(n)).resolves.toBe(true);
      expect(await rows()).toEqual([
        {
          id: n.id,
          recipient_id: alice,
          actor_id: bob,
          type: "like",
          post_id: post,
          comment_id: null,
          created_at: now,
          read_at: null,
        },
      ]);
    });

    it("dedupes a repeated like (same recipient, actor, post) and returns false", async () => {
      const first = build(likeBy(bob));
      await expect(insert(first)).resolves.toBe(true);
      await expect(insert(build(likeBy(bob)))).resolves.toBe(false);
      const all = await rows();
      expect(all).toHaveLength(1);
      expect(all[0]!.id).toBe(first.id);
    });

    it("keeps an existing read like untouched on a duplicate insert", async () => {
      const existing = await insertNotification(pool, {
        recipient_id: alice,
        actor_id: bob,
        type: "like",
        post_id: post,
        read_at: now,
      });
      await expect(insert(build(likeBy(bob)))).resolves.toBe(false);
      expect(await rows()).toEqual([existing]);
    });

    it("does not dedupe likes by different actors or on different posts", async () => {
      const otherPost = (await insertPost(pool, { author_id: alice })).id as PostId;
      await expect(insert(build(likeBy(bob)))).resolves.toBe(true);
      await expect(insert(build(likeBy(carol)))).resolves.toBe(true);
      await expect(insert(build(likeBy(bob, otherPost)))).resolves.toBe(true);
      expect(await rows()).toHaveLength(3);
    });

    it("dedupes a repeated follow (same recipient, actor) and returns false", async () => {
      await expect(insert(build(followOf(bob, alice)))).resolves.toBe(true);
      await expect(insert(build(followOf(bob, alice)))).resolves.toBe(false);
      expect(await rows()).toHaveLength(1);
    });

    it("treats follow directions and types independently", async () => {
      await expect(insert(build(followOf(bob, alice)))).resolves.toBe(true);
      await expect(insert(build(followOf(alice, bob)))).resolves.toBe(true);
      await expect(insert(build(likeBy(bob)))).resolves.toBe(true);
      expect((await rows()).map((r) => r.type).sort()).toEqual(["follow", "follow", "like"]);
    });

    it("never dedupes comment notifications", async () => {
      const c1 = (await insertComment(pool, { post_id: post, author_id: bob })).id as CommentId;
      const c2 = (await insertComment(pool, { post_id: post, author_id: bob })).id as CommentId;
      const comment = (commentId: CommentId): Target => ({
        type: "comment",
        recipientId: alice,
        actorId: bob,
        postId: post,
        commentId,
      });
      await expect(insert(build(comment(c1)))).resolves.toBe(true);
      await expect(insert(build(comment(c2)))).resolves.toBe(true);
      expect(await rows()).toHaveLength(2);
    });

    it("allows a like again after it was undone (like → unlike → like)", async () => {
      await insert(build(likeBy(bob)));
      await undo({ type: "like", actorId: bob, postId: post });
      await expect(insert(build(likeBy(bob)))).resolves.toBe(true);
      expect(await rows()).toHaveLength(1);
    });

    it("still raises on a primary-key clash instead of swallowing it", async () => {
      const id = uuidv7();
      await insert(build(likeBy(bob), id));
      await expect(insert(build(likeBy(carol), id))).rejects.toMatchObject({ code: "23505" });
      expect(await rows()).toHaveLength(1);
    });

    it("translates a missing target (FK 23503) into NOT_FOUND", async () => {
      const ghostPost = uuidv7() as PostId;
      await expect(insert(build(likeBy(bob, ghostPost)))).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await rows()).toHaveLength(0);
    });

    it("is rolled back with the surrounding transaction", async () => {
      await expect(
        uow.run(async (tx) => {
          await repo.insertIfAbsent(build(likeBy(bob)), tx);
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      expect(await rows()).toHaveLength(0);
    });
  });

  describe("deleteFor", () => {
    it("like: removes only that actor's like on that post", async () => {
      const otherPost = (await insertPost(pool, { author_id: alice })).id as PostId;
      await insert(build(likeBy(bob)));
      const keepCarol = build(likeBy(carol));
      const keepOtherPost = build(likeBy(bob, otherPost));
      const keepFollow = build(followOf(bob, alice));
      for (const n of [keepCarol, keepOtherPost, keepFollow]) await insert(n);

      await undo({ type: "like", actorId: bob, postId: post });

      expect((await rows()).map((r) => r.id).sort()).toEqual(
        [keepCarol.id, keepOtherPost.id, keepFollow.id].sort(),
      );
    });

    it("like: leaves comment notifications on the same post alone", async () => {
      const commentId = (await insertComment(pool, { post_id: post, author_id: bob })).id as CommentId;
      const comment = build({ type: "comment", recipientId: alice, actorId: bob, postId: post, commentId });
      await insert(comment);
      await insert(build(likeBy(bob)));

      await undo({ type: "like", actorId: bob, postId: post });

      expect((await rows()).map((r) => r.id)).toEqual([comment.id]);
    });

    it("follow: removes only that follower → followee notification", async () => {
      await insert(build(followOf(bob, alice)));
      const reverse = build(followOf(alice, bob));
      const otherFollower = build(followOf(carol, alice));
      const like = build(likeBy(bob));
      for (const n of [reverse, otherFollower, like]) await insert(n);

      await undo({ type: "follow", actorId: bob, recipientId: alice });

      expect((await rows()).map((r) => r.id).sort()).toEqual([reverse.id, otherFollower.id, like.id].sort());
    });

    it("is a no-op when no matching notification exists", async () => {
      const keep = build(followOf(carol, alice));
      await insert(keep);
      await expect(undo({ type: "like", actorId: bob, postId: post })).resolves.toBeUndefined();
      await expect(undo({ type: "follow", actorId: bob, recipientId: alice })).resolves.toBeUndefined();
      expect((await rows()).map((r) => r.id)).toEqual([keep.id]);
    });

    it("is rolled back with the surrounding transaction", async () => {
      await insert(build(likeBy(bob)));
      await expect(
        uow.run(async (tx) => {
          await repo.deleteFor({ type: "like", actorId: bob, postId: post }, tx);
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      expect(await rows()).toHaveLength(1);
    });
  });

  describe("read side (w06)", () => {
    it("remains a stub", async () => {
      await expect(repo.unreadCount(alice)).rejects.toMatchObject({ code: "INTERNAL" });
    });
  });
});
