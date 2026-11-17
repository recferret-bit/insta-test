import type pg from "pg";

import type { UserRelationView } from "../../domain/identity/views.js";
import type { Like } from "../../domain/posts/like.entity.js";
import type { LikeRepository } from "../../domain/posts/ports.js";
import { notImplemented } from "../../domain/shared/errors.js";
import type { PostId, UserId } from "../../domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";

/** `post_likes` adapter — w00 stub; implemented by w02 (likes). */
export class PgLikeRepository implements LikeRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insertIfAbsent(like: Like, tx: Tx): Promise<boolean> {
    return notImplemented("PgLikeRepository.insertIfAbsent");
  }

  async deleteIfPresent(postId: PostId, userId: UserId, tx: Tx): Promise<boolean> {
    return notImplemented("PgLikeRepository.deleteIfPresent");
  }

  async listLikers(
    postId: PostId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>> {
    return notImplemented("PgLikeRepository.listLikers");
  }
}
