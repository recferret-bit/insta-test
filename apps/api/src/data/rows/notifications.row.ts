/* Database Entity — mirrors the table columns exactly (persistence/03-row-mappers.md#row-types). */

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
