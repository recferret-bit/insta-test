import type { NotificationId, UserId } from "../shared/ids.js";

/** Marks `upToId` and all older (UUIDv7 order) notifications of the recipient read. */
export type MarkReadCommand = { recipientId: UserId; upToId: NotificationId };
