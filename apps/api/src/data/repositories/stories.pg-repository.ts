import type pg from "pg";

import { notImplemented } from "../../domain/shared/errors.js";
import type { StoryId, UserId } from "../../domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";
import type { StoryRepository } from "../../domain/stories/ports.js";
import type { StorySeen } from "../../domain/stories/story-seen.entity.js";
import type { Story } from "../../domain/stories/story.entity.js";
import type { StoryItemView, StoryTrayItem, StoryViewerView } from "../../domain/stories/views.js";

/** `stories` + `story_views` adapter — w00 stub; implemented by w04 (stories). */
export class PgStoryRepository implements StoryRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insert(s: Story, tx: Tx): Promise<void> {
    return notImplemented("PgStoryRepository.insert");
  }

  async findActive(id: StoryId, now: Date): Promise<Story | null> {
    return notImplemented("PgStoryRepository.findActive");
  }

  async deleteWithMedia(id: StoryId, tx: Tx): Promise<{ storageKey: string }> {
    return notImplemented("PgStoryRepository.deleteWithMedia");
  }

  async insertSeenIfAbsent(v: StorySeen): Promise<void> {
    return notImplemented("PgStoryRepository.insertSeenIfAbsent");
  }

  async tray(viewerId: UserId, now: Date): Promise<StoryTrayItem[]> {
    return notImplemented("PgStoryRepository.tray");
  }

  async listActiveByAuthor(authorId: UserId, viewerId: UserId | null, now: Date): Promise<StoryItemView[]> {
    return notImplemented("PgStoryRepository.listActiveByAuthor");
  }

  async getView(id: StoryId, viewerId: UserId | null, now: Date): Promise<StoryItemView | null> {
    return notImplemented("PgStoryRepository.getView");
  }

  async listViewers(id: StoryId, page: PageRequest<TimeCursor>): Promise<Page<StoryViewerView, TimeCursor>> {
    return notImplemented("PgStoryRepository.listViewers");
  }

  async deleteExpiredBefore(
    cutoff: Date,
    limit: number,
  ): Promise<{ storyId: StoryId; storageKey: string }[]> {
    return notImplemented("PgStoryRepository.deleteExpiredBefore");
  }
}
