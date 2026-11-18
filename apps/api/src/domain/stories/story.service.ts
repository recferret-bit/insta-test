import type { UserRepository } from "../identity/ports.js";
import type { Username } from "../identity/user.entity.js";
import type { UserSummaryView } from "../identity/views.js";
import { MediaAsset } from "../media/media-asset.entity.js";
import type { MediaRepository, MediaStorage } from "../media/ports.js";
import type { Clock } from "../shared/clock.js";
import { DomainError } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { StoryId, UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { UnitOfWork } from "../shared/unit-of-work.js";
import type { CreateStoryCommand } from "./commands.js";
import type { StoryRepository } from "./ports.js";
import { StorySeen } from "./story-seen.entity.js";
import { Story } from "./story.entity.js";
import type { StoryItemView, StoryTrayItem, StoryViewerView, UserStoriesView } from "./views.js";

/** pino-compatible error sink (domain may not import the HTTP logger). */
export type StoryServiceLogger = { error(obj: object, msg: string): void };

export type StoryServiceDeps = {
  stories: StoryRepository;
  media: MediaRepository;
  /** Not in the backend/02 port list: needed to remove the file after `deleteStory` commits (w00 gap). */
  storage: MediaStorage;
  /** Not in the backend/02 port list: needed to resolve `username` in `getUserStories` (w00 gap). */
  users: UserRepository;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  /** Optional: where post-commit file-removal failures of `deleteStory` are logged (w04 gap). */
  logger?: StoryServiceLogger;
};

function storyNotFound(): DomainError {
  return new DomainError("NOT_FOUND", "Story not found");
}

/** `F-BE-06` — stories (backend/02-services-and-use-cases.md#storyservice). */
export class StoryService {
  constructor(private readonly deps: StoryServiceDeps) {}

  /**
   * Locks the media row, `assertAttachable(purpose story)`, inserts the story (`expiresAt = now + 24h`) and
   * marks the media attached in one transaction. `MEDIA_INVALID` (missing, foreign, wrong purpose, attached).
   */
  async createStory(cmd: CreateStoryCommand): Promise<StoryItemView> {
    const { stories, media, uow, clock, ids } = this.deps;
    const now = clock.now();
    const story = await uow.run(async (tx) => {
      const [asset] = await media.findManyForUpdate([cmd.mediaId], tx);
      if (!asset) throw new DomainError("MEDIA_INVALID", "Media not found");
      MediaAsset.assertAttachable(asset, { ownerId: cmd.authorId, purpose: "story" });
      const created = Story.create({
        id: ids.uuidv7() as StoryId,
        authorId: cmd.authorId,
        mediaId: cmd.mediaId,
        now,
      });
      await stories.insert(created, tx);
      await media.markAttached([cmd.mediaId], tx);
      return created;
    });
    const view = await stories.getView(story.id, cmd.authorId, now);
    if (!view) throw new DomainError("INTERNAL", "Created story could not be read back");
    return view;
  }

  /**
   * Author only (`INV-10`). Deletes the story and its `media_assets` row in one tx, then removes the file;
   * a removal failure is logged, not surfaced. `NOT_FOUND` (missing/expired), `FORBIDDEN`.
   */
  async deleteStory(storyId: StoryId, actorId: UserId): Promise<void> {
    const { stories, storage, uow, clock, logger } = this.deps;
    const story = await stories.findActive(storyId, clock.now());
    if (!story) throw storyNotFound();
    if (story.authorId !== actorId) throw new DomainError("FORBIDDEN", "Only the author can delete a story");
    const { storageKey } = await uow.run((tx) => stories.deleteWithMedia(storyId, tx));
    try {
      await storage.remove(storageKey);
    } catch (err) {
      logger?.error({ err, storyId, storageKey }, "story file removal failed");
    }
  }

  /** Active stories of followees ∪ self (self first, then unseen, then most recent; max 100). */
  async getTray(viewerId: UserId): Promise<StoryTrayItem[]> {
    return this.deps.stories.tray(viewerId, this.deps.clock.now());
  }

  /** Active stories, `createdAt` ascending. Path usernames are case-insensitive. `NOT_FOUND`. */
  async getUserStories(username: string, viewerId: UserId | null = null): Promise<UserStoriesView> {
    const normalized = username.trim().toLowerCase() as Username;
    const profile = await this.deps.users.getProfileView(normalized, viewerId);
    if (!profile) throw new DomainError("NOT_FOUND", "User not found");
    const user: UserSummaryView = {
      id: profile.id,
      username: profile.username,
      fullName: profile.fullName,
      avatarStorageKey: profile.avatarStorageKey,
      viewerIsFollowing: profile.viewerIsFollowing,
    };
    const stories = await this.deps.stories.listActiveByAuthor(user.id, viewerId, this.deps.clock.now());
    return { user, stories };
  }

  /** Active check (`INV-06`); no-op for the author; insert-if-absent (first view wins). `NOT_FOUND`. */
  async markSeen(storyId: StoryId, viewerId: UserId): Promise<void> {
    const now = this.deps.clock.now();
    const story = await this.deps.stories.findActive(storyId, now);
    if (!story) throw storyNotFound();
    const seen = StorySeen.create(story, viewerId, now);
    if (seen) await this.deps.stories.insertSeenIfAbsent(seen);
  }

  /** Author only; `viewedAt` descending. `NOT_FOUND` (missing/expired), `FORBIDDEN`. */
  async listViewers(
    storyId: StoryId,
    actorId: UserId,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<StoryViewerView, TimeCursor>> {
    const story = await this.deps.stories.findActive(storyId, this.deps.clock.now());
    if (!story) throw storyNotFound();
    if (story.authorId !== actorId) {
      throw new DomainError("FORBIDDEN", "Only the author can see who viewed a story");
    }
    return this.deps.stories.listViewers(storyId, page);
  }
}
