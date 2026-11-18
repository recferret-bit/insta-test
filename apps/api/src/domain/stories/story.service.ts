import type { UserRepository } from "../identity/ports.js";
import type { MediaRepository, MediaStorage } from "../media/ports.js";
import type { Clock } from "../shared/clock.js";
import { notImplemented } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { StoryId, UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { UnitOfWork } from "../shared/unit-of-work.js";
import type { CreateStoryCommand } from "./commands.js";
import type { StoryRepository } from "./ports.js";
import type { StoryItemView, StoryTrayItem, StoryViewerView, UserStoriesView } from "./views.js";

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
};

/** `F-BE-06` — stories (backend/02-services-and-use-cases.md#storyservice). */
export class StoryService {
  constructor(private readonly deps: StoryServiceDeps) {}

  /** `MEDIA_INVALID`. */
  async createStory(cmd: CreateStoryCommand): Promise<StoryItemView> {
    return notImplemented("StoryService.createStory");
  }

  /** Author only. `NOT_FOUND`, `FORBIDDEN`. File removal after commit; failure not surfaced. */
  async deleteStory(storyId: StoryId, actorId: UserId): Promise<void> {
    return notImplemented("StoryService.deleteStory");
  }

  /** Active stories of followees ∪ self. */
  async getTray(viewerId: UserId): Promise<StoryTrayItem[]> {
    return notImplemented("StoryService.getTray");
  }

  /** Active stories ascending. `NOT_FOUND`. */
  async getUserStories(username: string, viewerId: UserId | null = null): Promise<UserStoriesView> {
    return notImplemented("StoryService.getUserStories");
  }

  /** Active check; no-op for the author; insert-if-absent. `NOT_FOUND`. */
  async markSeen(storyId: StoryId, viewerId: UserId): Promise<void> {
    return notImplemented("StoryService.markSeen");
  }

  /** Author only. `FORBIDDEN`, `NOT_FOUND`. */
  async listViewers(
    storyId: StoryId,
    actorId: UserId,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<StoryViewerView, TimeCursor>> {
    return notImplemented("StoryService.listViewers");
  }
}
