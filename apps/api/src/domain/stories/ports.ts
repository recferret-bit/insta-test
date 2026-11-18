import type { StoryId, UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { Tx } from "../shared/unit-of-work.js";
import type { StorySeen } from "./story-seen.entity.js";
import type { Story } from "./story.entity.js";
import type { StoryItemView, StoryTrayItem, StoryViewerView } from "./views.js";

export interface StoryRepository {
  insert(s: Story, tx: Tx): Promise<void>;
  findActive(id: StoryId, now: Date): Promise<Story | null>;
  /** Deletes the story and its `media_assets` row; returns the file key to remove after commit. */
  deleteWithMedia(id: StoryId, tx: Tx): Promise<{ storageKey: string }>;
  insertSeenIfAbsent(v: StorySeen): Promise<void>;
  tray(viewerId: UserId, now: Date): Promise<StoryTrayItem[]>;
  listActiveByAuthor(authorId: UserId, viewerId: UserId | null, now: Date): Promise<StoryItemView[]>;
  getView(id: StoryId, viewerId: UserId | null, now: Date): Promise<StoryItemView | null>;
  listViewers(id: StoryId, page: PageRequest<TimeCursor>): Promise<Page<StoryViewerView, TimeCursor>>;
  deleteExpiredBefore(cutoff: Date, limit: number): Promise<{ storyId: StoryId; storageKey: string }[]>;
}
