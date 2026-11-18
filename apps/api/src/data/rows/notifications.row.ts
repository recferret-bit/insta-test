/* Database Entity — mirrors the table columns exactly (persistence/03-row-mappers.md#row-types). */

import type { UserSummaryViewRow } from "./users.row.js";

/** `notifications` */
export type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: "like" | "comment" | "follow";
  post_id: string | null;
  comment_id: string | null;
  created_at: Date;
  read_at: Date | null;
};

/** Query result row for `NotificationView`: notification columns + `actor_*` summary + joined post/comment data. */
export type NotificationViewRow = NotificationRow &
  UserSummaryViewRow<"actor_"> & {
    /** `storage_key` of the post's position-0 media. */
    post_thumbnail_storage_key: string | null;
    /** Comment text truncated to 100 chars by the query or mapper. */
    comment_text: string | null;
  };
