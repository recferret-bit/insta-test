import {
  StoryResponseDto,
  StoryTrayItemDto,
  StoryViewerResponseDto,
  UserStoriesResponseDto,
} from "@insta/contracts";
import { describe, expect, it } from "vitest";

import {
  mapCreateStoryDtoToCommand,
  mapStoryItemViewToResponseDto,
  mapStoryTrayItemToDto,
  mapStoryViewerToResponseDto,
  mapUserStoriesViewToResponseDto,
} from "../../../src/api/mappers/stories.dto-mapper.js";
import { createUrlBuilder } from "../../../src/api/url-builder.js";
import type { UserSummaryView } from "../../../src/domain/identity/views.js";
import type { Username } from "../../../src/domain/identity/user.entity.js";
import { DomainError } from "../../../src/domain/shared/errors.js";
import type { MediaId, StoryId, UserId } from "../../../src/domain/shared/ids.js";
import type { StoryItemView } from "../../../src/domain/stories/views.js";

const urls = createUrlBuilder("https://api.example.test/");
const USER = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as UserId;
const STORY = "0190b000-0000-7000-8000-00000000abcd" as StoryId;
const MEDIA = "0190a1b2-c3d4-7e5f-8a9b-aaaaaaaaaaaa" as MediaId;

const author: UserSummaryView = {
  id: USER,
  username: "alice" as Username,
  fullName: "Alice",
  avatarStorageKey: "2026/11/avatar.png",
  viewerIsFollowing: true,
};

const item: StoryItemView = {
  id: STORY,
  author,
  media: {
    id: MEDIA,
    ownerId: USER,
    purpose: "story",
    kind: "image",
    mimeType: "image/jpeg",
    storageKey: `2026/11/${MEDIA}.jpg`,
    byteSize: 2048,
    width: 1080,
    height: 1920,
    durationMs: null,
    status: "attached",
    createdAt: new Date("2026-11-18T09:59:00.000Z"),
  },
  createdAt: new Date("2026-11-18T10:00:00.000Z"),
  expiresAt: new Date("2026-11-19T10:00:00.000Z"),
  viewerHasSeen: true,
  viewCount: null,
};

describe("stories DTO mappers (F-ECOMM-08)", () => {
  it("mapCreateStoryDtoToCommand parses the med_ public id", () => {
    const cmd = mapCreateStoryDtoToCommand({ media_id: "med_0190a1b2c3d47e5f8a9baaaaaaaaaaaa" }, USER);
    expect(cmd).toEqual({ authorId: USER, mediaId: MEDIA });
  });

  it("mapCreateStoryDtoToCommand rejects a wrong prefix with VALIDATION_FAILED on media_id", () => {
    try {
      mapCreateStoryDtoToCommand({ media_id: "pst_0190a1b2c3d47e5f8a9baaaaaaaaaaaa" }, USER);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe("VALIDATION_FAILED");
      expect((err as DomainError).details).toEqual([{ path: "media_id", message: expect.any(String) }]);
    }
  });

  it("mapStoryItemViewToResponseDto → valid StoryResponseDto with public ids and media URL", () => {
    const dto = StoryResponseDto.parse(mapStoryItemViewToResponseDto(item, urls));
    expect(dto).toMatchObject({
      id: `sty_${STORY.replace(/-/g, "")}`,
      created_at: "2026-11-18T10:00:00.000Z",
      expires_at: "2026-11-19T10:00:00.000Z",
      viewer_has_seen: true,
      view_count: null,
    });
    expect(dto.author).toEqual({
      id: `usr_${USER.replace(/-/g, "")}`,
      username: "alice",
      full_name: "Alice",
      avatar_url: "https://api.example.test/media/2026/11/avatar.png",
      is_following: true,
    });
    expect(dto.media.url).toBe(`https://api.example.test/media/2026/11/${MEDIA}.jpg`);
    expect(dto.media.purpose).toBe("story");
  });

  it("view_count is passed through for the author", () => {
    const dto = mapStoryItemViewToResponseDto({ ...item, viewCount: 7 }, urls);
    expect(dto.view_count).toBe(7);
  });

  it("mapStoryTrayItemToDto", () => {
    const dto = StoryTrayItemDto.parse(
      mapStoryTrayItemToDto(
        {
          user: { ...author, viewerIsFollowing: null },
          hasUnseen: false,
          latestStoryAt: item.createdAt,
          storyCount: 2,
        },
        urls,
      ),
    );
    expect(dto).toMatchObject({
      has_unseen: false,
      latest_story_at: "2026-11-18T10:00:00.000Z",
      story_count: 2,
    });
    expect(dto.user.is_following).toBeNull();
  });

  it("mapUserStoriesViewToResponseDto maps every story", () => {
    const dto = UserStoriesResponseDto.parse(
      mapUserStoriesViewToResponseDto({ user: author, stories: [item] }, urls),
    );
    expect(dto.stories).toHaveLength(1);
    expect(dto.user.username).toBe("alice");
  });

  it("mapStoryViewerToResponseDto", () => {
    const dto = StoryViewerResponseDto.parse(
      mapStoryViewerToResponseDto({ user: author, viewedAt: new Date("2026-11-18T11:00:00.000Z") }, urls),
    );
    expect(dto.viewed_at).toBe("2026-11-18T11:00:00.000Z");
  });
});
