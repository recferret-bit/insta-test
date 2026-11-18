import type { MediaAsset } from "../../../src/domain/media/media-asset.entity.js";
import { DomainError } from "../../../src/domain/shared/errors.js";
import type { MediaId, StoryId, UserId } from "../../../src/domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../../src/domain/shared/pagination.js";
import type { Tx } from "../../../src/domain/shared/unit-of-work.js";
import type { StoryRepository } from "../../../src/domain/stories/ports.js";
import type { StorySeen } from "../../../src/domain/stories/story-seen.entity.js";
import { isStoryActive, type Story } from "../../../src/domain/stories/story.entity.js";
import type { StoryItemView, StoryTrayItem, StoryViewerView } from "../../../src/domain/stories/views.js";
import type { UserSummaryView } from "../../../src/domain/identity/views.js";
import type { Username } from "../../../src/domain/identity/user.entity.js";

export function summary(id: UserId): UserSummaryView {
  return {
    id,
    username: `u_${id.slice(-4)}` as Username,
    fullName: "",
    avatarStorageKey: null,
    viewerIsFollowing: null,
  };
}

/**
 * In-memory `StoryRepository`. `rows` is a `Map` so `FakeUnitOfWork` can snapshot/rollback it.
 * Read models are built from `rows`, `seen` and the shared `media` map (for `StoryItemView.media`).
 */
export class FakeStories implements StoryRepository {
  rows = new Map<StoryId, Story>();
  seen: StorySeen[] = [];
  deleted: StoryId[] = [];
  trayCalls: { viewerId: UserId; now: Date }[] = [];
  trayResult: StoryTrayItem[] = [];
  viewersCalls: { id: StoryId; page: PageRequest<TimeCursor> }[] = [];
  expiredBatches: { storyId: StoryId; storageKey: string }[][] = [];
  expiredCalls: { cutoff: Date; limit: number }[] = [];

  constructor(private readonly media: { rows: Map<MediaId, MediaAsset> }) {}

  async insert(s: Story, _tx: Tx): Promise<void> {
    for (const existing of this.rows.values()) {
      if (existing.mediaId === s.mediaId) throw new DomainError("MEDIA_INVALID", "Media is already attached");
    }
    this.rows.set(s.id, { ...s });
  }

  async findActive(id: StoryId, now: Date): Promise<Story | null> {
    const s = this.rows.get(id);
    return s && isStoryActive(s, now) ? { ...s } : null;
  }

  async deleteWithMedia(id: StoryId, _tx: Tx): Promise<{ storageKey: string }> {
    const s = this.rows.get(id);
    if (!s) throw new DomainError("NOT_FOUND", "Story not found");
    const asset = this.media.rows.get(s.mediaId)!;
    this.rows.delete(id);
    this.media.rows.delete(s.mediaId);
    this.seen = this.seen.filter((v) => v.storyId !== id);
    this.deleted.push(id);
    return { storageKey: asset.storageKey };
  }

  async insertSeenIfAbsent(v: StorySeen): Promise<void> {
    if (this.seen.some((x) => x.storyId === v.storyId && x.viewerId === v.viewerId)) return;
    this.seen.push({ ...v });
  }

  async tray(viewerId: UserId, now: Date): Promise<StoryTrayItem[]> {
    this.trayCalls.push({ viewerId, now });
    return this.trayResult;
  }

  async listActiveByAuthor(authorId: UserId, viewerId: UserId | null, now: Date): Promise<StoryItemView[]> {
    return [...this.rows.values()]
      .filter((s) => s.authorId === authorId && isStoryActive(s, now))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((s) => this.view(s, viewerId));
  }

  async getView(id: StoryId, viewerId: UserId | null, now: Date): Promise<StoryItemView | null> {
    const s = this.rows.get(id);
    return s && isStoryActive(s, now) ? this.view(s, viewerId) : null;
  }

  async listViewers(id: StoryId, page: PageRequest<TimeCursor>): Promise<Page<StoryViewerView, TimeCursor>> {
    this.viewersCalls.push({ id, page });
    const items = this.seen
      .filter((v) => v.storyId === id)
      .sort((a, b) => b.viewedAt.getTime() - a.viewedAt.getTime())
      .slice(0, page.limit)
      .map((v) => ({ user: summary(v.viewerId), viewedAt: v.viewedAt }));
    return { items, nextCursor: null };
  }

  async deleteExpiredBefore(
    cutoff: Date,
    limit: number,
  ): Promise<{ storyId: StoryId; storageKey: string }[]> {
    this.expiredCalls.push({ cutoff, limit });
    return this.expiredBatches.shift() ?? [];
  }

  private view(s: Story, viewerId: UserId | null): StoryItemView {
    const seenBy = this.seen.filter((v) => v.storyId === s.id);
    return {
      id: s.id,
      author: summary(s.authorId),
      media: this.media.rows.get(s.mediaId)!,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      viewerHasSeen: viewerId !== null && seenBy.some((v) => v.viewerId === viewerId),
      viewCount: viewerId === s.authorId ? seenBy.length : null,
    };
  }
}
