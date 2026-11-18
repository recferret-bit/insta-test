import type pg from "pg";

import type { Post } from "../../domain/posts/post.entity.js";
import type { PostCounterDelta, PostRepository } from "../../domain/posts/ports.js";
import type { PostView } from "../../domain/posts/views.js";
import { notImplemented } from "../../domain/shared/errors.js";
import type { PostId, UserId } from "../../domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";

/** `posts` + `post_media` + `post_hashtags` adapter — w00 stub; implemented by w02 (posts). */
export class PgPostRepository implements PostRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insert(post: Post, tx: Tx): Promise<void> {
    return notImplemented("PgPostRepository.insert");
  }

  async findLive(id: PostId, tx?: Tx): Promise<Post | null> {
    return notImplemented("PgPostRepository.findLive");
  }

  async updateCaption(post: Post, tx: Tx): Promise<void> {
    return notImplemented("PgPostRepository.updateCaption");
  }

  async softDelete(id: PostId, now: Date, tx: Tx): Promise<void> {
    return notImplemented("PgPostRepository.softDelete");
  }

  async adjustCounters(
    id: PostId,
    delta: PostCounterDelta,
    tx: Tx,
  ): Promise<{ likeCount: number; commentCount: number }> {
    return notImplemented("PgPostRepository.adjustCounters");
  }

  async getView(id: PostId, viewerId: UserId | null): Promise<PostView | null> {
    return notImplemented("PgPostRepository.getView");
  }

  async listByAuthor(
    authorId: UserId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<PostView, TimeCursor>> {
    return notImplemented("PgPostRepository.listByAuthor");
  }
}
