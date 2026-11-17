import { z } from "zod";
import { IsoDateTime, publicId } from "../ids.ts";
import { LIMITS } from "../limits.ts";
import { MediaResponseDto, UserSummaryDto } from "./common.ts";

export const PostIdParams = z.object({ post_id: publicId("pst") }).strict();
export type PostIdParams = z.infer<typeof PostIdParams>;

export const CreatePostRequestDto = z
  .object({
    caption: z.string().trim().max(LIMITS.captionMax).default(""),
    /** 1–10 unique `med_…` IDs; array order = display order. */
    media_ids: z
      .array(publicId("med"))
      .min(LIMITS.postMediaMin)
      .max(LIMITS.postMediaMax)
      .refine((ids) => new Set(ids).size === ids.length, "media_ids must be unique"),
  })
  .strict();
export type CreatePostRequestDto = z.infer<typeof CreatePostRequestDto>;

/** Media are immutable after publish; only the caption can change. */
export const UpdatePostRequestDto = z
  .object({
    caption: z.string().trim().max(LIMITS.captionMax),
  })
  .strict();
export type UpdatePostRequestDto = z.infer<typeof UpdatePostRequestDto>;

export const PostResponseDto = z.object({
  id: publicId("pst"),
  author: UserSummaryDto,
  caption: z.string(),
  media: z.array(MediaResponseDto),
  /** Lowercased, without '#', in first-appearance order. */
  hashtags: z.array(z.string()),
  like_count: z.number().int().nonnegative(),
  comment_count: z.number().int().nonnegative(),
  viewer_has_liked: z.boolean(),
  created_at: IsoDateTime,
  updated_at: IsoDateTime,
});
export type PostResponseDto = z.infer<typeof PostResponseDto>;

/** Ordered `created_at DESC, id DESC`. Also used by `/feed` and `/explore`. */
export const PostPageResponseDto = z.object({
  items: z.array(PostResponseDto),
  next_cursor: z.string().nullable(),
});
export type PostPageResponseDto = z.infer<typeof PostPageResponseDto>;

export const LikeStateResponseDto = z.object({
  post_id: publicId("pst"),
  liked: z.boolean(),
  like_count: z.number().int().nonnegative(),
});
export type LikeStateResponseDto = z.infer<typeof LikeStateResponseDto>;
