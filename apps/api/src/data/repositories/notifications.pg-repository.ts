import type pg from "pg";

import type { Notification, NotificationUndoKey } from "../../domain/notifications/notification.entity.js";
import type { NotificationRepository } from "../../domain/notifications/ports.js";
import type { NotificationView } from "../../domain/notifications/views.js";
import { DomainError, notImplemented } from "../../domain/shared/errors.js";
import type { NotificationId, UserId } from "../../domain/shared/ids.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";
import { isForeignKeyViolation } from "../db/pg-errors.js";
import { queryable } from "../db/tx.js";
import { mapNotificationEntityToRow } from "../mappers/notifications.row-mapper.js";
import type { NotificationRow } from "../rows/notifications.row.js";

const NOTIFICATION_COLUMNS = "id, recipient_id, actor_id, type, post_id, comment_id, created_at, read_at";

/**
 * Conflict target for each type. Like and follow use the partial unique indexes
 * `notifications_like_uq` and `notifications_follow_uq` (persistence/02-migrations-and-indexes.md).
 * Comments have no dedupe index, so every comment creates a notification. The targets are named
 * so a primary-key clash still raises instead of being silently dropped.
 */
const DEDUPE_CONFLICT: Record<NotificationRow["type"], string> = {
  like: "ON CONFLICT (recipient_id, actor_id, post_id) WHERE type = 'like' DO NOTHING",
  follow: "ON CONFLICT (recipient_id, actor_id) WHERE type = 'follow' DO NOTHING",
  comment: "",
};

/** 23503 on insert → `NOT_FOUND` (persistence/03-row-mappers.md#error-translation-repositories). */
function translateInsertError(err: unknown): unknown {
  if (isForeignKeyViolation(err)) {
    return new DomainError("NOT_FOUND", "Notification target no longer exists");
  }
  return err;
}

/** `notifications` adapter (`F-BE-08`): writes are implemented in w01; reads stay stubs until w06. */
export class PgNotificationRepository implements NotificationRepository {
  constructor(private readonly pool: pg.Pool) {}

  /** Returns `true` if a row was inserted, or `false` if the like/follow notification already existed. */
  async insertIfAbsent(n: Notification, tx: Tx): Promise<boolean> {
    const row = mapNotificationEntityToRow(n);
    try {
      const result = await queryable(this.pool, tx).query(
        `INSERT INTO notifications (${NOTIFICATION_COLUMNS})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ${DEDUPE_CONFLICT[row.type]}`,
        [
          row.id,
          row.recipient_id,
          row.actor_id,
          row.type,
          row.post_id,
          row.comment_id,
          row.created_at,
          row.read_at,
        ],
      );
      return result.rowCount === 1;
    } catch (err) {
      throw translateInsertError(err);
    }
  }

  /** Undoing a like or follow removes the matching notification. Does nothing if there is none. */
  async deleteFor(kind: NotificationUndoKey, tx: Tx): Promise<void> {
    const db = queryable(this.pool, tx);
    if (kind.type === "like") {
      await db.query("DELETE FROM notifications WHERE type = 'like' AND actor_id = $1 AND post_id = $2", [
        kind.actorId,
        kind.postId,
      ]);
      return;
    }
    await db.query(
      "DELETE FROM notifications WHERE type = 'follow' AND actor_id = $1 AND recipient_id = $2",
      [kind.actorId, kind.recipientId],
    );
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
