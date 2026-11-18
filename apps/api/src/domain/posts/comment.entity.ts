import type { Brand, CommentId, PostId, UserId } from "../shared/ids.js";

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
