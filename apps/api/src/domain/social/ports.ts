import type { UserRelationView } from "../identity/views.js";
import type { UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { Tx } from "../shared/unit-of-work.js";
import type { Follow } from "./follow.entity.js";

export interface FollowRepository {
  insertIfAbsent(f: Follow, tx: Tx): Promise<boolean>;
  deleteIfPresent(followerId: UserId, followeeId: UserId, tx: Tx): Promise<boolean>;
  listFollowers(
    userId: UserId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>>;
  listFollowing(
    userId: UserId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>>;
}
