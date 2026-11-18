import { z } from "zod";

import { LIMITS } from "../limits.js";
import { page } from "../pagination.js";
import { UserSummaryDto } from "./common.js";
import { PostResponseDto } from "./posts.js";

const searchLimit = z.coerce
  .number()
  .int()
  .min(1)
  .max(LIMITS.searchLimitMax)
  .default(LIMITS.searchLimitDefault);

/** `GET /search/users?q&limit` — leading `@` stripping and lowercasing are done by the service. */
export const UserSearchQueryDto = z
  .object({
    q: z.string().trim().min(1).max(LIMITS.searchUsersQueryMax),
    limit: searchLimit,
  })
  .strict();
export type UserSearchQueryDto = z.infer<typeof UserSearchQueryDto>;

/** `GET /search/hashtags?q&limit` — leading `#` stripping and lowercasing are done by the service. */
export const HashtagSearchQueryDto = z
  .object({
    q: z.string().trim().min(1).max(LIMITS.searchHashtagsQueryMax),
    limit: searchLimit,
  })
  .strict();
export type HashtagSearchQueryDto = z.infer<typeof HashtagSearchQueryDto>;

/** Path params for `/hashtags/{tag}/posts`. */
export const HashtagParamsDto = z
  .object({
    tag: z.string().trim().toLowerCase().min(1).max(LIMITS.hashtagMax),
  })
  .strict();
export type HashtagParamsDto = z.infer<typeof HashtagParamsDto>;

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

export const HashtagPostsResponseDto = page(PostResponseDto).extend({
  tag: z.string(),
  post_count: z.number().int().nonnegative(),
});
export type HashtagPostsResponseDto = z.infer<typeof HashtagPostsResponseDto>;
