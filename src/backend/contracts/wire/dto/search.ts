import { z } from "zod";
import { LIMITS } from "../limits.ts";
import { UserSummaryDto } from "./common.ts";
import { PostResponseDto } from "./posts.ts";

const searchLimit = z.coerce
  .number()
  .int()
  .min(1)
  .max(LIMITS.searchLimitMax)
  .default(LIMITS.searchLimitDefault);

/** `GET /search/users?q&limit` — `q` lowercased, leading '@' stripped. */
export const UserSearchQuery = z
  .object({
    q: z
      .string()
      .trim()
      .toLowerCase()
      .transform((q) => q.replace(/^@/, ""))
      .pipe(z.string().min(1).max(LIMITS.userSearchQueryMax)),
    limit: searchLimit,
  })
  .strict();
export type UserSearchQuery = z.infer<typeof UserSearchQuery>;

/** `GET /search/hashtags?q&limit` — `q` lowercased, leading '#' stripped. */
export const HashtagSearchQuery = z
  .object({
    q: z
      .string()
      .trim()
      .toLowerCase()
      .transform((q) => q.replace(/^#/, ""))
      .pipe(z.string().min(1).max(LIMITS.hashtagSearchQueryMax)),
    limit: searchLimit,
  })
  .strict();
export type HashtagSearchQuery = z.infer<typeof HashtagSearchQuery>;

/** `/hashtags/{tag}/posts` path param; lowercased, leading '#' stripped. */
export const HashtagParams = z
  .object({
    tag: z
      .string()
      .trim()
      .toLowerCase()
      .transform((t) => t.replace(/^#/, ""))
      .pipe(z.string().regex(/^[\p{L}\p{N}_]{1,64}$/u, "Invalid hashtag")),
  })
  .strict();
export type HashtagParams = z.infer<typeof HashtagParams>;

export const UserSearchResponseDto = z.object({
  items: z.array(UserSummaryDto),
});
export type UserSearchResponseDto = z.infer<typeof UserSearchResponseDto>;

export const HashtagResultDto = z.object({
  tag: z.string(),
  post_count: z.number().int().nonnegative(),
});
export type HashtagResultDto = z.infer<typeof HashtagResultDto>;

export const HashtagSearchResponseDto = z.object({
  items: z.array(HashtagResultDto),
});
export type HashtagSearchResponseDto = z.infer<typeof HashtagSearchResponseDto>;

export const HashtagPostsResponseDto = z.object({
  items: z.array(PostResponseDto),
  next_cursor: z.string().nullable(),
  tag: z.string(),
  post_count: z.number().int().nonnegative(),
});
export type HashtagPostsResponseDto = z.infer<typeof HashtagPostsResponseDto>;
