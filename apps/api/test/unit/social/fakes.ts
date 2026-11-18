import type { UserCounterDelta } from "../../../src/domain/identity/ports.js";
import { User, type PasswordHash } from "../../../src/domain/identity/user.entity.js";
import type { UserRelationView } from "../../../src/domain/identity/views.js";
import type {
  Notification,
  NotificationUndoKey,
} from "../../../src/domain/notifications/notification.entity.js";
import type { NotificationRepository } from "../../../src/domain/notifications/ports.js";
import type { UserId } from "../../../src/domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../../src/domain/shared/pagination.js";
import type { Tx } from "../../../src/domain/shared/unit-of-work.js";
import type { Follow } from "../../../src/domain/social/follow.entity.js";
import type { FollowRepository } from "../../../src/domain/social/ports.js";
import { FakeUsers } from "../identity/fakes.js";

/** In-memory ports for `FollowService` unit tests. */

/** `FakeUsers` with real counter arithmetic and a log of `adjustCounters` calls (lock order). */
export class CountingUsers extends FakeUsers {
  counterCalls: { id: UserId; delta: UserCounterDelta }[] = [];

  override async adjustCounters(id: UserId, delta: UserCounterDelta, _tx: Tx): Promise<void> {
    this.counterCalls.push({ id, delta });
    const user = this.rows.get(id);
    if (!user) return;
    const stats = {
      posts: user.stats.posts + (delta.posts ?? 0),
      followers: user.stats.followers + (delta.followers ?? 0),
      following: user.stats.following + (delta.following ?? 0),
    };
    this.rows.set(id, { ...user, stats });
  }

  add(id: string, username: string): User {
    const user = User.register({
      id: id as UserId,
      username,
      email: `${username}@example.test`,
      passwordHash: "h" as PasswordHash,
      fullName: username,
      now: new Date("2026-11-01T00:00:00.000Z"),
    });
    this.rows.set(user.id, user);
    return user;
  }
}

const key = (followerId: UserId, followeeId: UserId) => `${followerId}->${followeeId}`;

export class FakeFollows implements FollowRepository {
  rows = new Map<string, Follow>();
  listCalls: {
    side: "followers" | "following";
    userId: UserId;
    viewerId: UserId | null;
    page: PageRequest<TimeCursor>;
  }[] = [];
  page: Page<UserRelationView, TimeCursor> = { items: [], nextCursor: null };

  async insertIfAbsent(f: Follow): Promise<boolean> {
    const k = key(f.followerId, f.followeeId);
    if (this.rows.has(k)) return false;
    this.rows.set(k, f);
    return true;
  }

  async deleteIfPresent(followerId: UserId, followeeId: UserId): Promise<boolean> {
    return this.rows.delete(key(followerId, followeeId));
  }

  async listFollowers(userId: UserId, viewerId: UserId | null, page: PageRequest<TimeCursor>) {
    this.listCalls.push({ side: "followers", userId, viewerId, page });
    return this.page;
  }

  async listFollowing(userId: UserId, viewerId: UserId | null, page: PageRequest<TimeCursor>) {
    this.listCalls.push({ side: "following", userId, viewerId, page });
    return this.page;
  }
}

export class FakeNotifications implements NotificationRepository {
  rows = new Map<string, Notification>();
  deleted: NotificationUndoKey[] = [];

  async insertIfAbsent(n: Notification): Promise<boolean> {
    const k = `${n.type}:${n.recipientId}:${n.actorId}`;
    if (this.rows.has(k)) return false;
    this.rows.set(k, n);
    return true;
  }

  async deleteFor(kind: NotificationUndoKey): Promise<void> {
    this.deleted.push(kind);
    if (kind.type === "follow") this.rows.delete(`follow:${kind.recipientId}:${kind.actorId}`);
  }

  list(): never {
    throw new Error("not used");
  }
  getView(): never {
    throw new Error("not used");
  }
  unreadCount(): never {
    throw new Error("not used");
  }
  markReadUpTo(): never {
    throw new Error("not used");
  }
}
