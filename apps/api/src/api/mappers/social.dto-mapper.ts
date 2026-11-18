import type { FollowListItemDto, FollowStateResponseDto } from "@insta/contracts";

import type { UserRelationView } from "../../domain/identity/views.js";
import type { FollowState } from "../../domain/social/follow.entity.js";
import type { UrlBuilder } from "../url-builder.js";
import { mapUserToSummaryDto } from "./identity.dto-mapper.js";
import { toPublicId } from "./shared.dto-mapper.js";

/**
 * Follows DTO ↔ Business mappers (external-communication/04-social-api.md#mapping-dto--business).
 * The path `username` is passed to `FollowService` inline by the route (no command object).
 */

/** `FollowState` → `FollowStateResponseDto` (`user_id` is the followee). */
export function mapFollowStateToResponseDto(state: FollowState): FollowStateResponseDto {
  return {
    user_id: toPublicId("usr", state.followeeId),
    following: state.following,
    followers_count: state.followersCount,
  };
}

/** `UserRelationView` → `FollowListItemDto`; `followed_at` carries the relation time. */
export function mapUserSummaryViewToFollowListItemDto(
  view: UserRelationView,
  urls: UrlBuilder,
): FollowListItemDto {
  return { ...mapUserToSummaryDto(view, urls), followed_at: view.relationAt.toISOString() };
}
