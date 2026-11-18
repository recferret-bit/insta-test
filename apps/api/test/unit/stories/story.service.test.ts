import { beforeEach, describe, expect, it } from "vitest";

import type { Email, PasswordHash, User, Username } from "../../../src/domain/identity/user.entity.js";
import type { MediaAsset } from "../../../src/domain/media/media-asset.entity.js";
import { DomainError } from "../../../src/domain/shared/errors.js";
import type { MediaId, StoryId, UserId } from "../../../src/domain/shared/ids.js";
import { STORY_TTL_MS, type Story } from "../../../src/domain/stories/story.entity.js";
import { StoryService } from "../../../src/domain/stories/story.service.js";
import { FakeClock } from "../../helpers/clock.js";
import { FakeMedia, FakeUnitOfWork, FakeUsers, SeqIds } from "../identity/fakes.js";
import { FakeStorage } from "../media/fakes.js";
import { FakeStories } from "./fakes.js";

const ALICE = "0190a1b2-c3d4-7e5f-8a9b-00000000a11c" as UserId;
const BOB = "0190a1b2-c3d4-7e5f-8a9b-000000000b0b" as UserId;
const START = "2026-11-18T10:00:00.000Z";

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof DomainError) return err.code;
    throw err;
  }
  throw new Error("expected a DomainError");
}

function asset(id: string, over: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: id as MediaId,
    ownerId: ALICE,
    purpose: "story",
    kind: "image",
    mimeType: "image/jpeg",
    storageKey: `2026/11/${id}.jpg`,
    byteSize: 100,
    width: 1080,
    height: 1920,
    durationMs: null,
    status: "uploaded",
    createdAt: new Date(START),
    ...over,
  };
}

function user(id: UserId, username: string): User {
  return {
    id,
    username: username as Username,
    email: `${username}@example.test` as Email,
    passwordHash: "hash" as PasswordHash,
    fullName: username,
    bio: "",
    avatarMediaId: null,
    stats: { posts: 0, followers: 0, following: 0 },
    createdAt: new Date(START),
    updatedAt: new Date(START),
  };
}

describe("StoryService (F-BE-06)", () => {
  let clock: FakeClock;
  let media: FakeMedia;
  let stories: FakeStories;
  let storage: FakeStorage;
  let users: FakeUsers;
  let uow: FakeUnitOfWork;
  let errors: { obj: object; msg: string }[];
  let service: StoryService;

  const MEDIA_1 = "0190a1b2-c3d4-7e5f-8a9b-000000000001";

  beforeEach(() => {
    clock = new FakeClock(START);
    media = new FakeMedia();
    stories = new FakeStories(media);
    storage = new FakeStorage();
    users = new FakeUsers();
    uow = new FakeUnitOfWork([media, stories]);
    errors = [];
    service = new StoryService({
      stories,
      media,
      storage,
      users,
      uow,
      clock,
      ids: new SeqIds(),
      logger: { error: (obj, msg) => errors.push({ obj, msg }) },
    });
    media.rows.set(MEDIA_1 as MediaId, asset(MEDIA_1));
  });

  /** Arrange an existing story directly in the fake. */
  function seedStory(authorId: UserId, createdAt = START, mediaId = MEDIA_1): Story {
    const created = new Date(createdAt);
    const s: Story = {
      id: `0190b000-0000-7000-8000-${String(stories.rows.size + 1).padStart(12, "0")}` as StoryId,
      authorId,
      mediaId: mediaId as MediaId,
      createdAt: created,
      expiresAt: new Date(created.getTime() + STORY_TTL_MS),
    };
    media.rows.set(s.mediaId, asset(mediaId, { ownerId: authorId, status: "attached" }));
    stories.rows.set(s.id, s);
    return s;
  }

  describe("createStory", () => {
    it("creates a story expiring 24h after the injected clock and attaches the media", async () => {
      const view = await service.createStory({ authorId: ALICE, mediaId: MEDIA_1 as MediaId });
      expect(view.createdAt.toISOString()).toBe(START);
      expect(view.expiresAt.getTime() - view.createdAt.getTime()).toBe(STORY_TTL_MS);
      expect(view.author.id).toBe(ALICE);
      expect(view.media.id).toBe(MEDIA_1);
      expect(view.viewerHasSeen).toBe(false);
      expect(view.viewCount).toBe(0);
      expect(media.rows.get(MEDIA_1 as MediaId)!.status).toBe("attached");
      expect(stories.rows.get(view.id)).toMatchObject({ authorId: ALICE, mediaId: MEDIA_1 });
    });

    it.each([
      ["missing media", () => media.rows.clear()],
      [
        "media owned by someone else",
        () => media.rows.set(MEDIA_1 as MediaId, asset(MEDIA_1, { ownerId: BOB })),
      ],
      [
        "media uploaded for a post",
        () => media.rows.set(MEDIA_1 as MediaId, asset(MEDIA_1, { purpose: "post" })),
      ],
      [
        "media already attached",
        () => media.rows.set(MEDIA_1 as MediaId, asset(MEDIA_1, { status: "attached" })),
      ],
    ])("MEDIA_INVALID for %s; nothing is written", async (_label, arrange) => {
      arrange();
      expect(await codeOf(service.createStory({ authorId: ALICE, mediaId: MEDIA_1 as MediaId }))).toBe(
        "MEDIA_INVALID",
      );
      expect(stories.rows.size).toBe(0);
    });

    it("accepts a story video", async () => {
      media.rows.set(
        MEDIA_1 as MediaId,
        asset(MEDIA_1, { kind: "video", mimeType: "video/mp4", durationMs: 5000 }),
      );
      const view = await service.createStory({ authorId: ALICE, mediaId: MEDIA_1 as MediaId });
      expect(view.media.kind).toBe("video");
    });

    it("a failure after the insert rolls the story back (single transaction)", async () => {
      media.markAttached = async () => {
        throw new Error("db down");
      };
      await expect(service.createStory({ authorId: ALICE, mediaId: MEDIA_1 as MediaId })).rejects.toThrow(
        "db down",
      );
      expect(uow.runs).toBe(1);
      expect(stories.rows.size).toBe(0);
    });

    it("a concurrent story on the same media (repository MEDIA_INVALID) leaves media uploaded", async () => {
      stories.insert = async () => {
        throw new DomainError("MEDIA_INVALID", "Media is already attached");
      };
      expect(await codeOf(service.createStory({ authorId: ALICE, mediaId: MEDIA_1 as MediaId }))).toBe(
        "MEDIA_INVALID",
      );
      expect(media.rows.get(MEDIA_1 as MediaId)!.status).toBe("uploaded");
    });
  });

  describe("deleteStory", () => {
    it("author deletes story + media row, then removes the file", async () => {
      const s = seedStory(ALICE);
      await service.deleteStory(s.id, ALICE);
      expect(stories.rows.has(s.id)).toBe(false);
      expect(media.rows.has(s.mediaId)).toBe(false);
      expect(storage.removed).toEqual([`2026/11/${MEDIA_1}.jpg`]);
    });

    it("FORBIDDEN for someone else; nothing removed", async () => {
      const s = seedStory(ALICE);
      expect(await codeOf(service.deleteStory(s.id, BOB))).toBe("FORBIDDEN");
      expect(stories.rows.has(s.id)).toBe(true);
      expect(storage.removed).toEqual([]);
    });

    it("NOT_FOUND for an unknown story", async () => {
      expect(
        await codeOf(service.deleteStory("0190b000-0000-7000-8000-00000000dead" as StoryId, ALICE)),
      ).toBe("NOT_FOUND");
    });

    it("NOT_FOUND once expired (INV-06), even for the author", async () => {
      const s = seedStory(ALICE);
      clock.advance(STORY_TTL_MS);
      expect(await codeOf(service.deleteStory(s.id, ALICE))).toBe("NOT_FOUND");
    });

    it("a file removal failure is logged, not surfaced", async () => {
      const s = seedStory(ALICE);
      storage.failRemove.add(`2026/11/${MEDIA_1}.jpg`);
      await expect(service.deleteStory(s.id, ALICE)).resolves.toBeUndefined();
      expect(stories.rows.has(s.id)).toBe(false);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.obj).toMatchObject({ storyId: s.id, storageKey: `2026/11/${MEDIA_1}.jpg` });
    });

    it("without a logger a removal failure is still swallowed", async () => {
      const quiet = new StoryService({ stories, media, storage, users, uow, clock, ids: new SeqIds() });
      const s = seedStory(ALICE);
      storage.failRemove.add(`2026/11/${MEDIA_1}.jpg`);
      await expect(quiet.deleteStory(s.id, ALICE)).resolves.toBeUndefined();
    });
  });

  describe("getTray", () => {
    it("delegates to the repository with the clock's now", async () => {
      await service.getTray(BOB);
      expect(stories.trayCalls).toEqual([{ viewerId: BOB, now: new Date(START) }]);
    });
  });

  describe("getUserStories", () => {
    beforeEach(() => {
      users.rows.set(ALICE, user(ALICE, "alice"));
      users.rows.set(BOB, user(BOB, "bob"));
    });

    it("returns active stories ascending, skipping expired ones; username is case-insensitive", async () => {
      const old = seedStory(ALICE, "2026-11-17T09:00:00.000Z", "0190a1b2-c3d4-7e5f-8a9b-000000000002");
      const later = seedStory(ALICE, "2026-11-18T09:30:00.000Z", "0190a1b2-c3d4-7e5f-8a9b-000000000003");
      const earlier = seedStory(ALICE, "2026-11-18T08:00:00.000Z", "0190a1b2-c3d4-7e5f-8a9b-000000000004");
      const view = await service.getUserStories("  Alice ", BOB);
      expect(view.user).toMatchObject({ id: ALICE, username: "alice", viewerIsFollowing: false });
      expect(view.user).not.toHaveProperty("bio");
      expect(view.stories.map((s) => s.id)).toEqual([earlier.id, later.id]);
      expect(view.stories.map((s) => s.id)).not.toContain(old.id);
    });

    it("anonymous viewer: follow flag null", async () => {
      const view = await service.getUserStories("alice");
      expect(view.user.viewerIsFollowing).toBeNull();
      expect(view.stories).toEqual([]);
    });

    it("NOT_FOUND for an unknown user", async () => {
      expect(await codeOf(service.getUserStories("nobody", null))).toBe("NOT_FOUND");
    });
  });

  describe("markSeen", () => {
    it("records the first view with the clock's time; repeat views keep the first", async () => {
      const s = seedStory(ALICE);
      clock.advance(1000);
      await service.markSeen(s.id, BOB);
      clock.advance(1000);
      await service.markSeen(s.id, BOB);
      expect(stories.seen).toEqual([
        { storyId: s.id, viewerId: BOB, viewedAt: new Date(Date.parse(START) + 1000) },
      ]);
    });

    it("author viewing their own story is a no-op", async () => {
      const s = seedStory(ALICE);
      await service.markSeen(s.id, ALICE);
      expect(stories.seen).toEqual([]);
    });

    it("NOT_FOUND for an expired story (boundary: now === expiresAt)", async () => {
      const s = seedStory(ALICE);
      clock.set(s.expiresAt);
      expect(await codeOf(service.markSeen(s.id, BOB))).toBe("NOT_FOUND");
      expect(stories.seen).toEqual([]);
    });

    it("still allowed 1 ms before expiry", async () => {
      const s = seedStory(ALICE);
      clock.set(new Date(s.expiresAt.getTime() - 1));
      await service.markSeen(s.id, BOB);
      expect(stories.seen).toHaveLength(1);
    });
  });

  describe("listViewers", () => {
    const page = { cursor: null, limit: 20 };

    it("author gets the viewer page", async () => {
      const s = seedStory(ALICE);
      await service.markSeen(s.id, BOB);
      const result = await service.listViewers(s.id, ALICE, page);
      expect(result.items.map((v) => v.user.id)).toEqual([BOB]);
      expect(stories.viewersCalls).toEqual([{ id: s.id, page }]);
    });

    it("FORBIDDEN for anyone but the author", async () => {
      const s = seedStory(ALICE);
      expect(await codeOf(service.listViewers(s.id, BOB, page))).toBe("FORBIDDEN");
      expect(stories.viewersCalls).toEqual([]);
    });

    it("NOT_FOUND for an expired story", async () => {
      const s = seedStory(ALICE);
      clock.advance(STORY_TTL_MS + 1);
      expect(await codeOf(service.listViewers(s.id, ALICE, page))).toBe("NOT_FOUND");
    });
  });
});
