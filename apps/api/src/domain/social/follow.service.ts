import type { UserRepository } from "../identity/ports.js";
import type { NotificationRepository } from "../notifications/ports.js";
import type { Clock } from "../shared/clock.js";
import { notImplemented } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { UserId } from "../shared/ids.js";
import type { PageRequest, TimeCursor } from "../shared/pagination.js";
import type { UnitOfWork } from "../shared/unit-of-work.js";
import type { FollowState } from "./follow.entity.js";
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

/** `F-BE-05` — follows (backend/02-services-and-use-cases.md#followservice). */
export class FollowService {
  constructor(private readonly deps: FollowServiceDeps) {}

  /** `NOT_FOUND`, `CANNOT_FOLLOW_SELF`. Emits `UserFollowed`, `NotificationCreated`. */
  async follow(followerId: UserId, username: string): Promise<FollowState> {
    return notImplemented("FollowService.follow");
  }

  /** `NOT_FOUND`. Idempotent. */
  async unfollow(followerId: UserId, username: string): Promise<FollowState> {
    return notImplemented("FollowService.unfollow");
  }

  /** `NOT_FOUND`. */
  async listFollowers(
    username: string,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<FollowListPage> {
    return notImplemented("FollowService.listFollowers");
  }

  /** `NOT_FOUND`. */
  async listFollowing(
    username: string,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<FollowListPage> {
    return notImplemented("FollowService.listFollowing");
  }
}
