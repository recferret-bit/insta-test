/* Database Entity — mirrors the table columns exactly (persistence/03-row-mappers.md#row-types). */

import type { UserSummaryViewRow } from "./users.row.js";

/** `comments` */
export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  text: string;
  created_at: Date;
  deleted_at: Date | null;
};

/** Comment list query row: `comments` columns + `author_*` user summary. */
export type CommentViewRow = CommentRow & UserSummaryViewRow<"author_">;
