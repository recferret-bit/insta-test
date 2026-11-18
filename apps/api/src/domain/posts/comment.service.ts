import type { NotificationRepository } from "../notifications/ports.js";
import type { Clock } from "../shared/clock.js";
import { notImplemented } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { CommentId, PostId, UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { UnitOfWork } from "../shared/unit-of-work.js";
import type { CreateCommentCommand } from "./commands.js";
import type { CommentRepository, PostRepository } from "./ports.js";
import type { CommentView } from "./views.js";

export type CommentServiceDeps = {
  comments: CommentRepository;
  posts: PostRepository;
  notifications: NotificationRepository;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
};

/** `F-BE-04` — comments (backend/02-services-and-use-cases.md#commentservice). */
export class CommentService {
  constructor(private readonly deps: CommentServiceDeps) {}

  /** `NOT_FOUND`, `VALIDATION_FAILED`. Emits `CommentAdded`, `NotificationCreated`, `PostCountersChanged`. */
  async addComment(cmd: CreateCommentCommand): Promise<CommentView> {
    return notImplemented("CommentService.addComment");
  }

  /** `NOT_FOUND`, `FORBIDDEN` (`INV-10`). Emits `PostCountersChanged`. */
  async deleteComment(commentId: CommentId, actorId: UserId): Promise<void> {
    return notImplemented("CommentService.deleteComment");
  }

  /** Ascending page; `NOT_FOUND` for a missing/deleted post. */
  async listComments(postId: PostId, page: PageRequest<TimeCursor>): Promise<Page<CommentView, TimeCursor>> {
    return notImplemented("CommentService.listComments");
  }
}
