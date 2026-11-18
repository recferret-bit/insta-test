import type { FollowListItemDto, LikeStateResponseDto, UserSummaryPageResponseDto } from "@insta/contracts";

import type { UserRelationView } from "../../domain/identity/views.js";
import type { LikeState } from "../../domain/posts/like.entity.js";
import type { Page, TimeCursor } from "../../domain/shared/pagination.js";
import type { UrlBuilder } from "../url-builder.js";
import { mapUserToSummaryDto } from "./identity.dto-mapper.js";
import { mapPageToResponseDto, toPublicId } from "./shared.dto-mapper.js";

/** Like DTO ↔ Business mappers (external-communication/04-social-api.md#mapping-dto--business). */

/** `LikeState` → `LikeStateResponseDto`. */
export function mapLikeStateToResponseDto(state: LikeState): LikeStateResponseDto {
  return { post_id: toPublicId("pst", state.postId), liked: state.liked, like_count: state.likeCount };
}

/** Liker (`UserRelationView`) → `FollowListItemDto`; `followed_at` carries the like time (04-social-api.md). */
export function mapLikerViewToListItemDto(view: UserRelationView, urls: UrlBuilder): FollowListItemDto {
  return { ...mapUserToSummaryDto(view, urls), followed_at: view.relationAt.toISOString() };
}

/** Likers page → `UserSummaryPageResponseDto`. */
export function mapLikerPageToResponseDto(
  page: Page<UserRelationView, TimeCursor>,
  urls: UrlBuilder,
): UserSummaryPageResponseDto {
  return mapPageToResponseDto(page, (view) => mapLikerViewToListItemDto(view, urls));
}
