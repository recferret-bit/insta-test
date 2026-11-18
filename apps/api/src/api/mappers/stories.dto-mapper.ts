import type {
  CreateStoryRequestDto,
  StoryResponseDto,
  StoryTrayItemDto,
  StoryViewerResponseDto,
  UserStoriesResponseDto,
} from "@insta/contracts";

import type { MediaId, UserId } from "../../domain/shared/ids.js";
import type { CreateStoryCommand } from "../../domain/stories/commands.js";
import type {
  StoryItemView,
  StoryTrayItem,
  StoryViewerView,
  UserStoriesView,
} from "../../domain/stories/views.js";
import type { UrlBuilder } from "../url-builder.js";
import { mapUserToSummaryDto } from "./identity.dto-mapper.js";
import { mapMediaToResponseDto } from "./media.dto-mapper.js";
import { parsePublicId, toPublicId } from "./shared.dto-mapper.js";

/** Stories DTO ↔ Business mappers (external-communication/05-stories-api.md#mapping-dto--business). */

/** `CreateStoryRequestDto` → `CreateStoryCommand` (`med_…` → UUID). */
export function mapCreateStoryDtoToCommand(dto: CreateStoryRequestDto, authorId: UserId): CreateStoryCommand {
  return { authorId, mediaId: parsePublicId<MediaId>("med", dto.media_id, "media_id") };
}

/** `StoryItemView` → `StoryResponseDto`. */
export function mapStoryItemViewToResponseDto(view: StoryItemView, urls: UrlBuilder): StoryResponseDto {
  return {
    id: toPublicId("sty", view.id),
    author: mapUserToSummaryDto(view.author, urls),
    media: mapMediaToResponseDto(view.media, urls),
    created_at: view.createdAt.toISOString(),
    expires_at: view.expiresAt.toISOString(),
    viewer_has_seen: view.viewerHasSeen,
    view_count: view.viewCount,
  };
}

/** `StoryTrayItem` → `StoryTrayItemDto`. */
export function mapStoryTrayItemToDto(item: StoryTrayItem, urls: UrlBuilder): StoryTrayItemDto {
  return {
    user: mapUserToSummaryDto(item.user, urls),
    has_unseen: item.hasUnseen,
    latest_story_at: item.latestStoryAt.toISOString(),
    story_count: item.storyCount,
  };
}

/** `UserStoriesView` → `UserStoriesResponseDto`. */
export function mapUserStoriesViewToResponseDto(
  view: UserStoriesView,
  urls: UrlBuilder,
): UserStoriesResponseDto {
  return {
    user: mapUserToSummaryDto(view.user, urls),
    stories: view.stories.map((s) => mapStoryItemViewToResponseDto(s, urls)),
  };
}

/** `StoryViewerView` → `StoryViewerResponseDto`. */
export function mapStoryViewerToResponseDto(view: StoryViewerView, urls: UrlBuilder): StoryViewerResponseDto {
  return { user: mapUserToSummaryDto(view.user, urls), viewed_at: view.viewedAt.toISOString() };
}
