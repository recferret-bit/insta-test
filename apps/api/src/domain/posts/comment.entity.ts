import { DomainError } from "../shared/errors.js";
import type { Brand, CommentId, PostId, UserId } from "../shared/ids.js";
import { DOMAIN_LIMITS } from "../shared/limits.js";

/** Trimmed, 1–500 chars. */
export type CommentText = Brand<string, "CommentText">;

export type Comment = {
  id: CommentId;
  postId: PostId;
  authorId: UserId;
  text: CommentText;
  createdAt: Date;
  deletedAt: Date | null;
};

export type CreateCommentInput = {
  id: CommentId;
  postId: PostId;
  authorId: UserId;
  text: string;
  now: Date;
};

/** Value object `CommentText` — trimmed, 1–500 code points (matches `comments_text_check`). */
export const CommentText = {
  parse(raw: string): CommentText {
    const value = raw.trim();
    const length = Array.from(value).length;
    if (length < 1 || length > DOMAIN_LIMITS.commentMax) {
      const message = `Comment must be 1–${DOMAIN_LIMITS.commentMax} characters`;
      throw new DomainError("VALIDATION_FAILED", message, [{ path: "text", message }]);
    }
    return value as CommentText;
  },
};

/** Entity factory & rules for `ENT-Comment`. */
export const Comment = {
  /** New live comment; `VALIDATION_FAILED` for empty/blank or > 500-char text. Post liveness is the service's job. */
  create(input: CreateCommentInput): Comment {
    return {
      id: input.id,
      postId: input.postId,
      authorId: input.authorId,
      text: CommentText.parse(input.text),
      createdAt: input.now,
      deletedAt: null,
    };
  },

  /** Allowed for the comment author or the post author (`INV-10`) → otherwise `FORBIDDEN`. */
  assertCanDelete(comment: Comment, actorId: UserId, postAuthorId: UserId): void {
    if (actorId !== comment.authorId && actorId !== postAuthorId) {
      throw new DomainError(
        "FORBIDDEN",
        "Only the comment author or the post author can delete this comment",
      );
    }
  },
};
