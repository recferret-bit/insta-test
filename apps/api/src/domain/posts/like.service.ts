import type { UserRelationView } from "../identity/views.js";
import type { NotificationRepository } from "../notifications/ports.js";
import type { Clock } from "../shared/clock.js";
import { notImplemented } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { PostId, UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { UnitOfWork } from "../shared/unit-of-work.js";
import type { LikeState } from "./like.entity.js";
import type { LikeRepository, PostRepository } from "./ports.js";

export type LikeServiceDeps = {
  likes: LikeRepository;
  posts: PostRepository;
  notifications: NotificationRepository;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
};

/** `F-BE-04` — likes (backend/02-services-and-use-cases.md#likeservice). */
export class LikeService {
  constructor(private readonly deps: LikeServiceDeps) {}

  /** Idempotent. Emits `PostLiked`, `NotificationCreated` (if any), `PostCountersChanged`. */
  async like(postId: PostId, userId: UserId): Promise<LikeState> {
    return notImplemented("LikeService.like");
  }

  /** Idempotent. Emits `PostCountersChanged` when a like was removed. */
  async unlike(postId: PostId, userId: UserId): Promise<LikeState> {
    return notImplemented("LikeService.unlike");
  }

  /** `NOT_FOUND` for a missing/deleted post. */
  async listLikers(
    postId: PostId,
    viewerId: UserId | null,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<UserRelationView, TimeCursor>> {
    return notImplemented("LikeService.listLikers");
  }
}
