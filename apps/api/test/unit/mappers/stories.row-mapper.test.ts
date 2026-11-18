import { describe, expect, it } from "vitest";

import {
  mapStoryEntityToRow,
  mapStoryRowToEntity,
  mapStorySeenEntityToRow,
  mapStoryViewRowToEntity,
} from "../../../src/data/mappers/stories.row-mapper.js";
import type { StoryRow, StoryViewRow } from "../../../src/data/rows/stories.row.js";
import type { MediaId, StoryId, UserId } from "../../../src/domain/shared/ids.js";
import type { StorySeen } from "../../../src/domain/stories/story-seen.entity.js";
import type { Story } from "../../../src/domain/stories/story.entity.js";

const story: Story = {
  id: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as StoryId,
  authorId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c" as UserId,
  mediaId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e" as MediaId,
  createdAt: new Date("2026-11-17T10:00:00.000Z"),
  expiresAt: new Date("2026-11-18T10:00:00.000Z"),
};

const seen: StorySeen = {
  storyId: story.id,
  viewerId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d" as UserId,
  viewedAt: new Date("2026-11-17T12:00:00.000Z"),
};

describe("stories row mapper", () => {
  it("round-trips entity → row → entity", () => {
    expect(mapStoryRowToEntity(mapStoryEntityToRow(story))).toEqual(story);
  });

  it("maps snake_case columns exactly", () => {
    const row: StoryRow = {
      id: story.id,
      author_id: story.authorId,
      media_id: story.mediaId,
      created_at: story.createdAt,
      expires_at: story.expiresAt,
    };
    expect(mapStoryEntityToRow(story)).toEqual(row);
    expect(mapStoryEntityToRow(mapStoryRowToEntity(row))).toEqual(row);
  });
});

describe("story_views row mapper", () => {
  it("round-trips StorySeen → row → StorySeen", () => {
    expect(mapStoryViewRowToEntity(mapStorySeenEntityToRow(seen))).toEqual(seen);
  });

  it("maps snake_case columns exactly", () => {
    const row: StoryViewRow = { story_id: seen.storyId, viewer_id: seen.viewerId, viewed_at: seen.viewedAt };
    expect(mapStorySeenEntityToRow(seen)).toEqual(row);
    expect(mapStoryViewRowToEntity(row)).toEqual(seen);
  });
});
