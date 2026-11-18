import type { Clock } from "../shared/clock.js";
import { notImplemented } from "../shared/errors.js";
import type { UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { UnitOfWork } from "../shared/unit-of-work.js";
import type { MarkReadCommand } from "./commands.js";
import type { NotificationRepository } from "./ports.js";
import type { NotificationView } from "./views.js";

export type NotificationServiceDeps = {
  notifications: NotificationRepository;
  uow: UnitOfWork;
  clock: Clock;
};

/**
 * `F-BE-08` — notification read side (backend/02-services-and-use-cases.md#notificationservice).
 * Creation happens inside Like/Comment/Follow transactions via `NotificationRepository`.
 */
export class NotificationService {
  constructor(private readonly deps: NotificationServiceDeps) {}

  /** Excludes notifications whose post/comment is soft-deleted. */
  async list(
    recipientId: UserId,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<NotificationView, TimeCursor>> {
    return notImplemented("NotificationService.list");
  }

  async unreadCount(recipientId: UserId): Promise<number> {
    return notImplemented("NotificationService.unreadCount");
  }

  /** Returns the new unread count. Emits `NotificationsRead`. */
  async markRead(cmd: MarkReadCommand): Promise<number> {
    return notImplemented("NotificationService.markRead");
  }
}
