import type { NotificationId, UserId } from "../shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../shared/pagination.js";
import type { Tx } from "../shared/unit-of-work.js";
import type { Notification, NotificationUndoKey } from "./notification.entity.js";
import type { NotificationView } from "./views.js";

export interface NotificationRepository {
  /** Dedupe via `notifications_like_uq` / `notifications_follow_uq`. */
  insertIfAbsent(n: Notification, tx: Tx): Promise<boolean>;
  deleteFor(kind: NotificationUndoKey, tx: Tx): Promise<void>;
  list(recipientId: UserId, page: PageRequest<TimeCursor>): Promise<Page<NotificationView, TimeCursor>>;
  getView(id: NotificationId): Promise<NotificationView | null>;
  unreadCount(recipientId: UserId): Promise<number>;
  markReadUpTo(recipientId: UserId, upToId: NotificationId, now: Date): Promise<void>;
}
