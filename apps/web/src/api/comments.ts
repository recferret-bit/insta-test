/** Comment endpoints — external-communication/04-social-api.md. */
import { CommentPageResponseDto, CommentResponseDto, type CreateCommentRequestDto } from "@insta/contracts";

import { request, seg, type InputOf, type PageParams } from "./http";

export type CreateCommentBody = InputOf<typeof CreateCommentRequestDto>;

/** `GET /posts/{post_id}/comments?cursor&limit` (oldest first) → `200 CommentPageResponseDto`. */
export function getComments(
  postId: string,
  page: PageParams = {},
  signal?: AbortSignal,
): Promise<CommentPageResponseDto> {
  return request("GET", `/posts/${seg(postId)}/comments`, {
    query: page,
    schema: CommentPageResponseDto,
    signal,
  });
}

/** `POST /posts/{post_id}/comments` → `201 CommentResponseDto`. */
export function createComment(
  postId: string,
  body: CreateCommentBody,
  signal?: AbortSignal,
): Promise<CommentResponseDto> {
  return request("POST", `/posts/${seg(postId)}/comments`, { body, schema: CommentResponseDto, signal });
}

/** `DELETE /comments/{comment_id}` → `204`. */
export function deleteComment(commentId: string, signal?: AbortSignal): Promise<void> {
  return request<void>("DELETE", `/comments/${seg(commentId)}`, { signal });
}
