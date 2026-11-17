/** Users, profile & follow endpoints — external-communication/02-auth-and-users-api.md, 04-social-api.md. */
import {
  FollowStateResponseDto,
  MeResponseDto,
  UserProfileResponseDto,
  UserSummaryPageResponseDto,
  type UpdateProfileRequestDto,
} from "@insta/contracts";

import { request, seg, type InputOf, type PageParams } from "./http";

export type UpdateProfileBody = InputOf<typeof UpdateProfileRequestDto>;

/** `GET /me` → `200 MeResponseDto`. */
export function getMe(signal?: AbortSignal): Promise<MeResponseDto> {
  return request("GET", "/me", { schema: MeResponseDto, signal });
}

/** `PATCH /me` (only changed fields) → `200 MeResponseDto`. */
export function updateMe(body: UpdateProfileBody, signal?: AbortSignal): Promise<MeResponseDto> {
  return request("PATCH", "/me", { body, schema: MeResponseDto, signal });
}

/** `GET /users/{username}` → `200 UserProfileResponseDto`. */
export function getUserProfile(username: string, signal?: AbortSignal): Promise<UserProfileResponseDto> {
  return request("GET", `/users/${seg(username)}`, { schema: UserProfileResponseDto, signal });
}

/** `PUT /users/{username}/follow` (idempotent) → `200 FollowStateResponseDto`. */
export function followUser(username: string, signal?: AbortSignal): Promise<FollowStateResponseDto> {
  return request("PUT", `/users/${seg(username)}/follow`, { schema: FollowStateResponseDto, signal });
}

/** `DELETE /users/{username}/follow` (idempotent) → `200 FollowStateResponseDto`. */
export function unfollowUser(username: string, signal?: AbortSignal): Promise<FollowStateResponseDto> {
  return request("DELETE", `/users/${seg(username)}/follow`, { schema: FollowStateResponseDto, signal });
}

/** `GET /users/{username}/followers?cursor&limit` → `200 UserSummaryPageResponseDto`. */
export function getFollowers(
  username: string,
  page: PageParams = {},
  signal?: AbortSignal,
): Promise<UserSummaryPageResponseDto> {
  return request("GET", `/users/${seg(username)}/followers`, {
    query: page,
    schema: UserSummaryPageResponseDto,
    signal,
  });
}

/** `GET /users/{username}/following?cursor&limit` → `200 UserSummaryPageResponseDto`. */
export function getFollowing(
  username: string,
  page: PageParams = {},
  signal?: AbortSignal,
): Promise<UserSummaryPageResponseDto> {
  return request("GET", `/users/${seg(username)}/following`, {
    query: page,
    schema: UserSummaryPageResponseDto,
    signal,
  });
}
