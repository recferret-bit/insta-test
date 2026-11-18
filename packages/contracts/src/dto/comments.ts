import { z } from "zod";

import { publicId } from "../ids.js";
import { LIMITS } from "../limits.js";
import { page } from "../pagination.js";
import { IsoDateTime, UserSummaryDto } from "./common.js";

/** Path params for `/comments/{comment_id}`. */
export const CommentIdParamsDto = z.object({ comment_id: publicId("cmt") }).strict();
export type CommentIdParamsDto = z.infer<typeof CommentIdParamsDto>;

export const CreateCommentRequestDto = z
  .object({
    /** 1–500 chars after trim. */
    text: z.string().trim().min(1).max(LIMITS.commentMax),
  })
  .strict();
export type CreateCommentRequestDto = z.infer<typeof CreateCommentRequestDto>;

export const CommentResponseDto = z.object({
  id: publicId("cmt"),
  post_id: publicId("pst"),
  author: UserSummaryDto,
  text: z.string(),
  created_at: IsoDateTime,
});
export type CommentResponseDto = z.infer<typeof CommentResponseDto>;

/** Ordered `created_at ASC, id ASC`. */
export const CommentPageResponseDto = page(CommentResponseDto);
export type CommentPageResponseDto = z.infer<typeof CommentPageResponseDto>;
