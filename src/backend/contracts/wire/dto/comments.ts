import { z } from "zod";
import { IsoDateTime, publicId } from "../ids.ts";
import { LIMITS } from "../limits.ts";
import { UserSummaryDto } from "./common.ts";

export const CommentIdParams = z.object({ comment_id: publicId("cmt") }).strict();
export type CommentIdParams = z.infer<typeof CommentIdParams>;

export const CreateCommentRequestDto = z
  .object({
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
export const CommentPageResponseDto = z.object({
  items: z.array(CommentResponseDto),
  next_cursor: z.string().nullable(),
});
export type CommentPageResponseDto = z.infer<typeof CommentPageResponseDto>;
