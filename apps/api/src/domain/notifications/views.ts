import type { UserSummaryView } from "../identity/views.js";
import type { Notification } from "./notification.entity.js";

export type NotificationView = Omit<Notification, "actorId" | "recipientId"> & {
  actor: UserSummaryView;
  /** First media of the post. */
  postThumbnailStorageKey: string | null;
  /** Truncated to 100 chars. */
  commentText: string | null;
};
