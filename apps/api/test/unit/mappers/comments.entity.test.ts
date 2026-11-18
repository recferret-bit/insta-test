import { describe, expect, it } from "vitest";

import { Comment, CommentText, type CreateCommentInput } from "../../../src/domain/posts/comment.entity.js";
import { DomainError, type ErrorCode } from "../../../src/domain/shared/errors.js";
import type { CommentId, PostId, UserId } from "../../../src/domain/shared/ids.js";

const now = new Date("2026-11-18T10:00:00.000Z");
const postAuthorId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a01" as UserId;
const commenterId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a02" as UserId;
const strangerId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a03" as UserId;
const input: CreateCommentInput = {
  id: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a30" as CommentId,
  postId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a20" as PostId,
  authorId: commenterId,
  text: "  Nice!  ",
  now,
};

function expectCode(fn: () => unknown, code: ErrorCode): void {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

describe("CommentText.parse", () => {
  it("trims and accepts 1 and 500 chars (code points)", () => {
    expect(CommentText.parse(" a ")).toBe("a");
    expect(CommentText.parse("x".repeat(500))).toHaveLength(500);
    expect(CommentText.parse("😀".repeat(500))).toHaveLength(1000);
  });

  it.each([
    ["empty", ""],
    ["blank", "   \n\t"],
    ["501 chars", "x".repeat(501)],
  ])("rejects %s with VALIDATION_FAILED on path text", (_label, text) => {
    expectCode(() => CommentText.parse(text), "VALIDATION_FAILED");
    try {
      CommentText.parse(text);
    } catch (err) {
      expect((err as DomainError).details).toEqual([expect.objectContaining({ path: "text" })]);
    }
  });
});

describe("Comment", () => {
  it("create() trims text and starts live", () => {
    expect(Comment.create(input)).toEqual({
      id: input.id,
      postId: input.postId,
      authorId: commenterId,
      text: "Nice!",
      createdAt: now,
      deletedAt: null,
    });
    expectCode(() => Comment.create({ ...input, text: " " }), "VALIDATION_FAILED");
  });

  it("assertCanDelete allows the comment author and the post author only (INV-10)", () => {
    const comment = Comment.create(input);
    expect(() => Comment.assertCanDelete(comment, commenterId, postAuthorId)).not.toThrow();
    expect(() => Comment.assertCanDelete(comment, postAuthorId, postAuthorId)).not.toThrow();
    expectCode(() => Comment.assertCanDelete(comment, strangerId, postAuthorId), "FORBIDDEN");
  });
});
