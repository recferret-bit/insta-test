import { describe, expect, it } from "vitest";

import {
  mapNotificationEntityToRow,
  mapNotificationRowToEntity,
  mapNotificationViewRow,
} from "../../../src/data/mappers/notifications.row-mapper.js";
import type { NotificationRow, NotificationViewRow } from "../../../src/data/rows/notifications.row.js";
import type { Notification } from "../../../src/domain/notifications/notification.entity.js";
import type { CommentId, NotificationId, PostId, UserId } from "../../../src/domain/shared/ids.js";

const like: Notification = {
  id: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a10" as NotificationId,
  recipientId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a01" as UserId,
  actorId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a02" as UserId,
  type: "like",
  postId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a11" as PostId,
  commentId: null,
  createdAt: new Date("2026-11-18T10:00:00.000Z"),
  readAt: null,
};
const comment: Notification = {
  ...like,
  type: "comment",
  commentId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a12" as CommentId,
  readAt: new Date("2026-11-18T11:00:00.000Z"),
};
const follow: Notification = { ...like, type: "follow", postId: null };

describe("notifications row mapper", () => {
  it.each([
    ["like", like],
    ["comment", comment],
    ["follow", follow],
  ])("round-trips %s entity → row → entity", (_label, n) => {
    expect(mapNotificationRowToEntity(mapNotificationEntityToRow(n))).toEqual(n);
  });

  it("maps to snake_case columns", () => {
    expect(mapNotificationEntityToRow(comment)).toEqual<NotificationRow>({
      id: comment.id,
      recipient_id: comment.recipientId,
      actor_id: comment.actorId,
      type: "comment",
      post_id: comment.postId,
      comment_id: comment.commentId,
      created_at: comment.createdAt,
      read_at: comment.readAt,
    });
  });

  describe("mapNotificationViewRow", () => {
    const row: NotificationViewRow = {
      ...mapNotificationEntityToRow(comment),
      actor_id: comment.actorId,
      actor_username: "bob",
      actor_full_name: "Bob",
      actor_avatar_storage_key: null,
      actor_is_following: true,
      post_thumbnail_storage_key: "2026/11/thumb.jpg",
      comment_text: "nice",
    };

    it("drops recipient/actor ids and embeds the actor summary", () => {
      const view = mapNotificationViewRow(row);
      expect(view).toEqual({
        id: comment.id,
        type: "comment",
        postId: comment.postId,
        commentId: comment.commentId,
        createdAt: comment.createdAt,
        readAt: comment.readAt,
        actor: {
          id: comment.actorId,
          username: "bob",
          fullName: "Bob",
          avatarStorageKey: null,
          viewerIsFollowing: true,
        },
        postThumbnailStorageKey: "2026/11/thumb.jpg",
        commentText: "nice",
      });
      expect(view).not.toHaveProperty("recipientId");
      expect(view).not.toHaveProperty("actorId");
    });

    it("truncates comment text to 100 chars and keeps null", () => {
      expect(mapNotificationViewRow({ ...row, comment_text: "x".repeat(100) }).commentText).toHaveLength(100);
      expect(mapNotificationViewRow({ ...row, comment_text: "y".repeat(101) }).commentText).toBe(
        "y".repeat(100),
      );
      expect(
        mapNotificationViewRow({ ...row, comment_text: null, post_thumbnail_storage_key: null }),
      ).toMatchObject({
        commentText: null,
        postThumbnailStorageKey: null,
      });
    });
  });
});
