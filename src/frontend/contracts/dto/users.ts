// Source: docs/specs/external-communication/02-auth-and-users-api.md, 04-social-api.md (follows).
import type { MediaId, UserId } from "../ids.ts";
import type { Page } from "../pagination.ts";
import type { UserSummaryDto } from "./common.ts";

export type SignupRequestDto = {
  username: string;
  email: string;
  password: string;
  full_name?: string;
};

export type LoginRequestDto = {
  /** Username or email. */
  login: string;
  password: string;
};

export type UserProfileResponseDto = {
  id: UserId;
  username: string;
  full_name: string;
  bio: string;
  avatar_url: string | null;
  posts_count: number;
  followers_count: number;
  following_count: number;
  /** null for anonymous or self. */
  is_following: boolean | null;
  has_active_story: boolean;
  created_at: string;
};

export type MeResponseDto = UserProfileResponseDto & { email: string };

export type AuthTokenResponseDto = {
  access_token: string;
  token_type: "Bearer";
  expires_at: string;
  user: MeResponseDto;
};

/** PATCH /me — at least one field required; unknown fields rejected. */
export type UpdateProfileRequestDto = {
  username?: string;
  full_name?: string;
  bio?: string;
  /** med_… (purpose avatar, kind image) or null to remove. */
  avatar_media_id?: MediaId | null;
};

export type SseTicketResponseDto = { ticket: string; expires_at: string };

export type FollowStateResponseDto = {
  user_id: UserId;
  following: boolean;
  followers_count: number;
};

export type FollowListItemDto = UserSummaryDto & {
  /** Relation time; for `GET /posts/{id}/likes` carries the like's created_at. */
  followed_at: string | null;
};

export type UserSummaryPageResponseDto = Page<FollowListItemDto>;
