import type {
  CreatePostRequestDto,
  PostPageResponseDto,
  PostResponseDto,
  UpdatePostRequestDto,
} from "@insta/contracts";

import type { CreatePostCommand, UpdatePostCaptionCommand } from "../../domain/posts/commands.js";
import type { PostView } from "../../domain/posts/views.js";
import type { MediaId, PostId, UserId } from "../../domain/shared/ids.js";
import type { Page, TimeCursor } from "../../domain/shared/pagination.js";
import type { UrlBuilder } from "../url-builder.js";
import { mapUserToSummaryDto } from "./identity.dto-mapper.js";
import { mapMediaToResponseDto } from "./media.dto-mapper.js";
import { mapPageToResponseDto, parsePublicId, toPublicId } from "./shared.dto-mapper.js";

/**
 * Post DTO ↔ Business mappers (external-communication/03-media-and-posts-api.md#mapping-dto--business).
 * Request DTOs arrive already validated by their Zod schema; the domain re-validates invariants.
 */

/** `CreatePostRequestDto` → `CreatePostCommand`; `med_…` IDs parsed in display order (`media_ids.<i>` paths). */
export function mapCreatePostDtoToCommand(dto: CreatePostRequestDto, authorId: UserId): CreatePostCommand {
  return {
    authorId,
    caption: dto.caption,
    mediaIds: dto.media_ids.map((id, i) => parsePublicId<MediaId>("med", id, `media_ids.${i}`)),
  };
}

/** `UpdatePostRequestDto` + path `post_id` → `UpdatePostCaptionCommand`. */
export function mapUpdatePostDtoToCommand(
  dto: UpdatePostRequestDto,
  postId: PostId,
  actorId: UserId,
): UpdatePostCaptionCommand {
  return { postId, actorId, caption: dto.caption };
}

/** `PostView` → `PostResponseDto` (media in position order, URLs via `UrlBuilder`). */
export function mapPostViewToResponseDto(view: PostView, urls: UrlBuilder): PostResponseDto {
  return {
    id: toPublicId("pst", view.id),
    author: mapUserToSummaryDto(view.author, urls),
    caption: view.caption,
    media: view.media.map((m) => mapMediaToResponseDto(m, urls)),
    hashtags: [...view.hashtags],
    like_count: view.likeCount,
    comment_count: view.commentCount,
    viewer_has_liked: view.viewerHasLiked,
    created_at: view.createdAt.toISOString(),
    updated_at: view.updatedAt.toISOString(),
  };
}

/** `Page<PostView>` → `PostPageResponseDto` (`next_cursor` encoded from the keyset cursor). */
export function mapPostPageToResponseDto(
  page: Page<PostView, TimeCursor>,
  urls: UrlBuilder,
): PostPageResponseDto {
  return mapPageToResponseDto(page, (view) => mapPostViewToResponseDto(view, urls));
}
