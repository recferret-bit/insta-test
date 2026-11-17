/** `CommentViewModel` & comment form mapper (frontend/02). Owned by w02 after w00. */
import type { CommentResponseDto } from "@insta/contracts";

import type { CreateCommentBody } from "../../api/comments";
import { formatFullDate, formatRelativeTime } from "./format";
import { toUserSummaryVM, type UserSummaryViewModel } from "./user";

export type CommentViewModel = {
  id: string;
  postId: string;
  author: UserSummaryViewModel;
  text: string;
  createdAt: string;
  createdAtRelative: string;
  createdAtTitle: string;
  /** Own comment, or a comment on the viewer's own post. */
  canDelete: boolean;
};

export type CommentMapContext = {
  viewerId: string | null;
  /** `usr_…` of the post's author (lets the post owner moderate comments). */
  postAuthorId: string | null;
  now?: Date;
};

export function toCommentVM(dto: CommentResponseDto, ctx: CommentMapContext): CommentViewModel {
  const viewer = ctx.viewerId;
  return {
    id: dto.id,
    postId: dto.post_id,
    author: toUserSummaryVM(dto.author),
    text: dto.text,
    createdAt: dto.created_at,
    createdAtRelative: formatRelativeTime(dto.created_at, ctx.now),
    createdAtTitle: formatFullDate(dto.created_at),
    canDelete: viewer !== null && (viewer === dto.author.id || viewer === ctx.postAuthorId),
  };
}

export function toCreateCommentDto(text: string): CreateCommentBody {
  return { text: text.trim() };
}
