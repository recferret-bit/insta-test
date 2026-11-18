import { z } from "zod";

import { publicId } from "../ids.js";
import { LIMITS } from "../limits.js";
import { page } from "../pagination.js";
import { IsoDateTime, MediaResponseDto, UserSummaryDto } from "./common.js";

/** Path params for `/posts/{post_id}/…`. */
export const PostIdParamsDto = z.object({ post_id: publicId("pst") }).strict();
export type PostIdParamsDto = z.infer<typeof PostIdParamsDto>;

export const CreatePostRequestDto = z
  .object({
    caption: z.string().max(LIMITS.captionMax).default(""),
    /** 1–10 unique `med_…` IDs; array order = display order. */
    media_ids: z
      .array(publicId("med"))
      .min(LIMITS.postMediaMin)
      .max(LIMITS.postMediaMax)
      .refine((ids) => new Set(ids).size === ids.length, { message: "Media IDs must be unique" }),
  })
  .strict();
export type CreatePostRequestDto = z.infer<typeof CreatePostRequestDto>;

/** Media are immutable after publish; only the caption can change. */
export const UpdatePostRequestDto = z
  .object({
    caption: z.string().max(LIMITS.captionMax),
  })
  .strict();
export type UpdatePostRequestDto = z.infer<typeof UpdatePostRequestDto>;

export const PostResponseDto = z.object({
  id: publicId("pst"),
  author: UserSummaryDto,
  caption: z.string(),
  /** Ordered by position. */
  media: z.array(MediaResponseDto),
  /** Lowercased, without `#`, first-appearance order. */
  hashtags: z.array(z.string()),
  like_count: z.number().int().nonnegative(),
  comment_count: z.number().int().nonnegative(),
  viewer_has_liked: z.boolean(),
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
});
export type PostResponseDto = z.infer<typeof PostResponseDto>;

/** Ordered `created_at DESC, id DESC`. */
export const PostPageResponseDto = page(PostResponseDto);
export type PostPageResponseDto = z.infer<typeof PostPageResponseDto>;

export const LikeStateResponseDto = z.object({
  post_id: publicId("pst"),
  liked: z.boolean(),
  like_count: z.number().int().nonnegative(),
});
export type LikeStateResponseDto = z.infer<typeof LikeStateResponseDto>;
