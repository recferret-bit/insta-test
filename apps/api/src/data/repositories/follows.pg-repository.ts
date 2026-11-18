import type pg from "pg";

import type { UserRelationView } from "../../domain/identity/views.js";
import { notImplemented } from "../../domain/shared/errors.js";
import type { UserId } from "../../domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";
import type { Follow } from "../../domain/social/follow.entity.js";
import type { FollowRepository } from "../../domain/social/ports.js";

/** `follows` adapter — w00 stub; implemented by w03 (social). */
export class PgFollowRepository implements FollowRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insertIfAbsent(f: Follow, tx: Tx): Promise<boolean> {
    return notImplemented("PgFollowRepository.insertIfAbsent");
  }

  async deleteIfPresent(followerId: UserId, followeeId: UserId, tx: Tx): Promise<boolean> {
    return notImplemented("PgFollowRepository.deleteIfPresent");
  }

  async listFollowers(
    userId: UserId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>> {
    return notImplemented("PgFollowRepository.listFollowers");
  }

  async listFollowing(
    userId: UserId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>> {
    return notImplemented("PgFollowRepository.listFollowing");
  }
}
