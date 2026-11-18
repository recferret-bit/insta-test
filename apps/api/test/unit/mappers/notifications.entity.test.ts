import { describe, expect, it } from "vitest";

import {
  type CreateNotificationInput,
  Notification,
} from "../../../src/domain/notifications/notification.entity.js";
import { DomainError } from "../../../src/domain/shared/errors.js";
import type { CommentId, NotificationId, PostId, UserId } from "../../../src/domain/shared/ids.js";

const now = new Date("2026-11-18T10:00:00.000Z");
const id = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a10" as NotificationId;
const recipientId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a01" as UserId;
const actorId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a02" as UserId;
const postId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a11" as PostId;
const commentId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a12" as CommentId;
const base = { id, recipientId, actorId, now };

describe("Notification.create", () => {
  it("like: post set, comment null, unread", () => {
    expect(Notification.create({ ...base, type: "like", postId })).toEqual({
      id,
      recipientId,
      actorId,
      type: "like",
      postId,
      commentId: null,
      createdAt: now,
      readAt: null,
    });
  });

  it("comment: post and comment set", () => {
    expect(Notification.create({ ...base, type: "comment", postId, commentId })).toMatchObject({
      type: "comment",
      postId,
      commentId,
    });
  });

  it("follow: no post, no comment", () => {
    expect(Notification.create({ ...base, type: "follow" })).toMatchObject({
      type: "follow",
      postId: null,
      commentId: null,
    });
  });

  it.each<CreateNotificationInput>([
    { ...base, type: "like", postId },
    { ...base, type: "comment", postId, commentId },
    { ...base, type: "follow" },
  ])("returns null for self-actions (INV-08): $type", (input) => {
    expect(Notification.create({ ...input, actorId: recipientId })).toBeNull();
  });

  it.each([
    ["like without post", { ...base, type: "like", postId: null }],
    ["like with comment", { ...base, type: "like", postId, commentId }],
    ["comment without comment", { ...base, type: "comment", postId, commentId: null }],
    ["comment without post", { ...base, type: "comment", postId: null, commentId }],
    ["follow with post", { ...base, type: "follow", postId }],
    ["follow with comment", { ...base, type: "follow", commentId }],
    ["unknown type", { ...base, type: "mention" }],
  ])("rejects %s", (_label, input) => {
    expect(() => Notification.create(input as unknown as CreateNotificationInput)).toThrow(DomainError);
  });
});
