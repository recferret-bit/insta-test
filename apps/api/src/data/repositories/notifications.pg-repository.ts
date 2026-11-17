import type pg from "pg";

import type { Notification, NotificationUndoKey } from "../../domain/notifications/notification.entity.js";
import type { NotificationRepository } from "../../domain/notifications/ports.js";
import type { NotificationView } from "../../domain/notifications/views.js";
import { notImplemented } from "../../domain/shared/errors.js";
import type { NotificationId, UserId } from "../../domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";

/** `notifications` adapter — w00 stub; writes implemented by w01, reads by w06. */
export class PgNotificationRepository implements NotificationRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insertIfAbsent(n: Notification, tx: Tx): Promise<boolean> {
    return notImplemented("PgNotificationRepository.insertIfAbsent");
  }

  async deleteFor(kind: NotificationUndoKey, tx: Tx): Promise<void> {
    return notImplemented("PgNotificationRepository.deleteFor");
  }

  async list(
    recipientId: UserId,
    page: PageRequest<TimeCursor>,
  ): Promise<Page<NotificationView, TimeCursor>> {
    return notImplemented("PgNotificationRepository.list");
  }

  async getView(id: NotificationId): Promise<NotificationView | null> {
    return notImplemented("PgNotificationRepository.getView");
  }

  async unreadCount(recipientId: UserId): Promise<number> {
    return notImplemented("PgNotificationRepository.unreadCount");
  }

  async markReadUpTo(recipientId: UserId, upToId: NotificationId, now: Date): Promise<void> {
    return notImplemented("PgNotificationRepository.markReadUpTo");
  }
}
