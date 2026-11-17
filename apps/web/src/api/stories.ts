/** Story endpoints — external-communication/05-stories-api.md. */
import {
  StoryResponseDto,
  StoryTrayResponseDto,
  StoryViewerPageResponseDto,
  UserStoriesResponseDto,
  type CreateStoryRequestDto,
} from "@insta/contracts";

import { request, seg, type InputOf, type PageParams } from "./http";

export type CreateStoryBody = InputOf<typeof CreateStoryRequestDto>;

/** `POST /stories` → `201 StoryResponseDto`. */
export function createStory(body: CreateStoryBody, signal?: AbortSignal): Promise<StoryResponseDto> {
  return request("POST", "/stories", { body, schema: StoryResponseDto, signal });
}

/** `DELETE /stories/{story_id}` → `204`. */
export function deleteStory(storyId: string, signal?: AbortSignal): Promise<void> {
  return request<void>("DELETE", `/stories/${seg(storyId)}`, { signal });
}

/** `GET /stories/tray` (auth required) → `200 StoryTrayResponseDto`. */
export function getStoryTray(signal?: AbortSignal): Promise<StoryTrayResponseDto> {
  return request("GET", "/stories/tray", { schema: StoryTrayResponseDto, signal });
}

/** `GET /users/{username}/stories` → `200 UserStoriesResponseDto`. */
export function getUserStories(username: string, signal?: AbortSignal): Promise<UserStoriesResponseDto> {
  return request("GET", `/users/${seg(username)}/stories`, { schema: UserStoriesResponseDto, signal });
}

/** `POST /stories/{story_id}/seen` (idempotent) → `204`. */
export function markStorySeen(storyId: string, signal?: AbortSignal): Promise<void> {
  return request<void>("POST", `/stories/${seg(storyId)}/seen`, { signal });
}

/** `GET /stories/{story_id}/viewers?cursor&limit` (author only) → `200 StoryViewerPageResponseDto`. */
export function getStoryViewers(
  storyId: string,
  page: PageParams = {},
  signal?: AbortSignal,
): Promise<StoryViewerPageResponseDto> {
  return request("GET", `/stories/${seg(storyId)}/viewers`, {
    query: page,
    schema: StoryViewerPageResponseDto,
    signal,
  });
}
