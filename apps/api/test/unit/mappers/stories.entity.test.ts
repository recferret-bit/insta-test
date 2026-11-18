import { describe, expect, it } from "vitest";

import type { MediaId, StoryId, UserId } from "../../../src/domain/shared/ids.js";
import { StorySeen } from "../../../src/domain/stories/story-seen.entity.js";
import { STORY_TTL_MS, Story, isStoryActive } from "../../../src/domain/stories/story.entity.js";

const now = new Date("2026-11-18T10:00:00.000Z");
const authorId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c" as UserId;
const viewerId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d" as UserId;
const input = {
  id: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as StoryId,
  authorId,
  mediaId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e" as MediaId,
  now,
};

describe("Story.create", () => {
  it("expires exactly 24 h after creation", () => {
    expect(STORY_TTL_MS).toBe(86_400_000);
    expect(Story.create(input)).toEqual({
      id: input.id,
      authorId,
      mediaId: input.mediaId,
      createdAt: now,
      expiresAt: new Date("2026-11-19T10:00:00.000Z"),
    });
  });

  it("does not share the Date instance between createdAt and expiresAt", () => {
    const s = Story.create(input);
    expect(s.expiresAt).not.toBe(s.createdAt);
    expect(s.expiresAt.getTime() - s.createdAt.getTime()).toBe(STORY_TTL_MS);
  });
});

describe("Story.isActive (INV-06)", () => {
  const s = Story.create(input);

  it("is active from creation until strictly before expiresAt", () => {
    expect(Story.isActive(s, now)).toBe(true);
    expect(Story.isActive(s, new Date(s.expiresAt.getTime() - 1))).toBe(true);
  });

  it("is inactive at and after expiresAt", () => {
    expect(Story.isActive(s, s.expiresAt)).toBe(false);
    expect(isStoryActive(s, new Date(s.expiresAt.getTime() + 1))).toBe(false);
  });
});

describe("StorySeen.create", () => {
  const s = Story.create(input);

  it("records a non-author viewer at now", () => {
    const later = new Date("2026-11-18T11:00:00.000Z");
    expect(StorySeen.create(s, viewerId, later)).toEqual({ storyId: s.id, viewerId, viewedAt: later });
  });

  it("returns null when the author views their own story", () => {
    expect(StorySeen.create(s, authorId, now)).toBeNull();
  });
});
