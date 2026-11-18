import { z } from "zod";

import { publicId } from "../ids.js";
import { page } from "../pagination.js";
import {
  BioField,
  FullNameField,
  IsoDateTime,
  UserSummaryDto,
  UsernameField,
  UsernameParam,
} from "./common.js";

/** Path params for `/users/{username}/…`. */
export const UsernameParamsDto = z.object({ username: UsernameParam }).strict();
export type UsernameParamsDto = z.infer<typeof UsernameParamsDto>;

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

/** `PATCH /me` — at least one field; unknown fields rejected. */
export const UpdateProfileRequestDto = z
  .object({
    username: UsernameField.optional(),
    full_name: FullNameField.optional(),
    bio: BioField.optional(),
    /** `med_…` (purpose avatar, kind image) or `null` to remove. */
    avatar_media_id: publicId("med").nullable().optional(),
  })
  .strict()
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: "At least one field is required",
  });
export type UpdateProfileRequestDto = z.infer<typeof UpdateProfileRequestDto>;

export const FollowStateResponseDto = z.object({
  /** `usr_…` of the followee. */
  user_id: publicId("usr"),
  following: z.boolean(),
  followers_count: z.number().int().nonnegative(),
});
export type FollowStateResponseDto = z.infer<typeof FollowStateResponseDto>;

export const FollowListItemDto = UserSummaryDto.extend({
  /** Relation time (follow `created_at`, or like `created_at` for `GET /posts/{id}/likes`). */
  followed_at: IsoDateTime.nullable(),
});
export type FollowListItemDto = z.infer<typeof FollowListItemDto>;

/** Followers, following and likers lists — ordered by relation time DESC. */
export const UserSummaryPageResponseDto = page(FollowListItemDto);
export type UserSummaryPageResponseDto = z.infer<typeof UserSummaryPageResponseDto>;
