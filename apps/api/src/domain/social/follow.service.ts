import type { UserRepository } from "../identity/ports.js";
import type { User, Username } from "../identity/user.entity.js";
import { Notification } from "../notifications/notification.entity.js";
import type { NotificationRepository } from "../notifications/ports.js";
import type { Clock } from "../shared/clock.js";
import { DomainError } from "../shared/errors.js";
import type { DomainEvent } from "../shared/events.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { NotificationId, UserId } from "../shared/ids.js";
import type { PageRequest, TimeCursor } from "../shared/pagination.js";
import type { Tx, UnitOfWork } from "../shared/unit-of-work.js";
import { Follow, FollowState } from "./follow.entity.js";
import type { FollowRepository } from "./ports.js";
import type { FollowListPage } from "./views.js";

export type FollowServiceDeps = {
  follows: FollowRepository;
  users: UserRepository;
  notifications: NotificationRepository;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
};

/** Same normalisation as `IdentityService.getProfile`: unknown or malformed names are simply `NOT_FOUND`. */
function normalizeUsername(raw: string): Username {
  return raw.trim().toLowerCase() as Username;
}

function userNotFound(): DomainError {
  return new DomainError("NOT_FOUND", "User not found");
}

/** `F-BE-05` — follows (backend/02-services-and-use-cases.md#followservice). */
export class FollowService {
  constructor(private readonly deps: FollowServiceDeps) {}

  /**
   * Idempotent: an existing relation returns the current state with no counter change, event or
   * notification. `NOT_FOUND`, `CANNOT_FOLLOW_SELF`. Emits `UserFollowed`, `NotificationCreated`.
   */
  async follow(followerId: UserId, username: string): Promise<FollowState> {
    return this.deps.uow.run(async (tx, events) => {
      const followee = await this.requireUser(username, tx);
      const now = this.deps.clock.now();
      const follow = Follow.create(followerId, followee.id, now);

      if (await this.deps.follows.insertIfAbsent(follow, tx)) {
        await this.adjustBothCounters(followerId, followee.id, 1, tx);
        const emitted: DomainEvent[] = [
          { type: "UserFollowed", followerId, followeeId: followee.id, at: now },
        ];
        const notification = Notification.create({
          type: "follow",
          id: this.deps.ids.uuidv7() as NotificationId,
          recipientId: followee.id,
          actorId: followerId,
          now,
        });
        if (notification && (await this.deps.notifications.insertIfAbsent(notification, tx))) {
          emitted.push({
            type: "NotificationCreated",
            notificationId: notification.id,
            recipientId: notification.recipientId,
          });
        }
        events.add(...emitted);
      }
      return FollowState.of(followee.id, true, await this.followersCount(followee.id, tx));
    });
  }

  /** Idempotent: a missing relation (incl. self) returns `{ following: false }` unchanged. `NOT_FOUND`. */
  async unfollow(followerId: UserId, username: string): Promise<FollowState> {
    return this.deps.uow.run(async (tx) => {
      const followee = await this.requireUser(username, tx);
      if (await this.deps.follows.deleteIfPresent(followerId, followee.id, tx)) {
        await this.adjustBothCounters(followerId, followee.id, -1, tx);
        await this.deps.notifications.deleteFor(
          { type: "follow", actorId: followerId, recipientId: followee.id },
          tx,
        );
      }
      return FollowState.of(followee.id, false, await this.followersCount(followee.id, tx));
    });
  }

  /** Users following `username`, newest relation first. `NOT_FOUND`. */
  async listFollowers(
    username: string,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<FollowListPage> {
    const user = await this.requireUser(username);
    return this.deps.follows.listFollowers(user.id, viewerId, page);
  }

  /** Users that `username` follows, newest relation first. `NOT_FOUND`. */
  async listFollowing(
    username: string,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<FollowListPage> {
    const user = await this.requireUser(username);
    return this.deps.follows.listFollowing(user.id, viewerId, page);
  }

  private async requireUser(username: string, tx?: Tx): Promise<User> {
    const user = await this.deps.users.findByUsername(normalizeUsername(username), tx);
    if (!user) throw userNotFound();
    return user;
  }

  /**
   * `follower.following_count` and `followee.followers_count` in one tx. Rows are updated (and
   * therefore row-locked) in ascending id order so concurrent mutual follows cannot deadlock.
   */
  private async adjustBothCounters(
    followerId: UserId,
    followeeId: UserId,
    step: 1 | -1,
    tx: Tx,
  ): Promise<void> {
    const updates: Array<[UserId, { followers?: number; following?: number }]> = [
      [followerId, { following: step }],
      [followeeId, { followers: step }],
    ];
    updates.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    for (const [id, delta] of updates) {
      await this.deps.users.adjustCounters(id, delta, tx);
    }
  }

  /** Followee's count re-read inside the tx, so it reflects this tx's counter update. */
  private async followersCount(followeeId: UserId, tx: Tx): Promise<number> {
    const user = await this.deps.users.findById(followeeId, tx);
    if (!user) throw userNotFound();
    return user.stats.followers;
  }
}
