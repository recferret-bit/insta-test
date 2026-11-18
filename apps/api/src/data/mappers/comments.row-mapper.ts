import type { Comment, CommentText } from "../../domain/posts/comment.entity.js";
import type { CommentView } from "../../domain/posts/views.js";
import type { CommentId, PostId, UserId } from "../../domain/shared/ids.js";
import type { CommentRow, CommentViewRow } from "../rows/comments.row.js";
import { mapUserSummaryViewRow } from "./users.row-mapper.js";

/** `ENT-Comment` Row → Business Entity (persistence/03-row-mappers.md#mapper-catalog). */
export function mapCommentRowToEntity(row: CommentRow): Comment {
  return {
    id: row.id as CommentId,
    postId: row.post_id as PostId,
    authorId: row.author_id as UserId,
    text: row.text as CommentText,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

/** `ENT-Comment` Business Entity → Row. */
export function mapCommentEntityToRow(comment: Comment): CommentRow {
  return {
    id: comment.id,
    post_id: comment.postId,
    author_id: comment.authorId,
    text: comment.text,
    created_at: comment.createdAt,
    deleted_at: comment.deletedAt,
  };
}

/** Comment list/get query row (`comments` + `author_*` summary) → `CommentView`. */
export function mapCommentViewRow(row: CommentViewRow): CommentView {
  return {
    id: row.id as CommentId,
    postId: row.post_id as PostId,
    author: mapUserSummaryViewRow(row, "author_"),
    text: row.text as CommentText,
    createdAt: row.created_at,
  };
}
