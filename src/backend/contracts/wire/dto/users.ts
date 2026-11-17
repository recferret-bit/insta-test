import { z } from "zod";
import { IsoDateTime, publicId } from "../ids.ts";
import { LIMITS } from "../limits.ts";
import { UserSummaryDto, UsernameInput } from "./common.ts";

export const UserProfileResponseDto = z.object({
  id: publicId("usr"),
  username: z.string(),
  full_name: z.string(),
  bio: z.string(),
  avatar_url: z.string().nullable(),
  posts_count: z.number().int().nonnegative(),
  followers_count: z.number().int().nonnegative(),
  following_count: z.number().int().nonnegative(),
  /** `null` for anonymous or self. */
  is_following: z.boolean().nullable(),
  has_active_story: z.boolean(),
  created_at: IsoDateTime,
});
export type UserProfileResponseDto = z.infer<typeof UserProfileResponseDto>;

export const MeResponseDto = UserProfileResponseDto.extend({
  email: z.string(),
});
export type MeResponseDto = z.infer<typeof MeResponseDto>;

function countNewlines(s: string): number {
  return (s.match(/\n/g) ?? []).length;
}

/** `PATCH /me` — at least one field; unknown fields rejected. */
export const UpdateProfileRequestDto = z
  .object({
    username: UsernameInput.optional(),
    full_name: z.string().trim().max(LIMITS.fullNameMax).optional(),
    bio: z
      .string()
      .max(LIMITS.bioMax)
      .refine((b) => countNewlines(b) <= LIMITS.bioMaxNewlines, `Bio allows at most ${LIMITS.bioMaxNewlines} line breaks`)
      .optional(),
    avatar_media_id: publicId("med").nullable().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, "At least one field is required");
export type UpdateProfileRequestDto = z.infer<typeof UpdateProfileRequestDto>;

export const FollowStateResponseDto = z.object({
  user_id: publicId("usr"),
  following: z.boolean(),
  followers_count: z.number().int().nonnegative(),
});
export type FollowStateResponseDto = z.infer<typeof FollowStateResponseDto>;

/** Followers / following / likers list item; `followed_at` = relation time. */
export const FollowListItemDto = UserSummaryDto.extend({
  followed_at: IsoDateTime.nullable(),
});
export type FollowListItemDto = z.infer<typeof FollowListItemDto>;

export const UserSummaryPageResponseDto = z.object({
  items: z.array(FollowListItemDto),
  next_cursor: z.string().nullable(),
});
export type UserSummaryPageResponseDto = z.infer<typeof UserSummaryPageResponseDto>;
