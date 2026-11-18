import { z } from "zod";

import { publicId } from "../ids.js";
import { page } from "../pagination.js";
import { IsoDateTime, UserSummaryDto } from "./common.js";

export const NOTIFICATION_TYPES = ["like", "comment", "follow"] as const;
export const NotificationTypeDto = z.enum(NOTIFICATION_TYPES);
export type NotificationTypeDto = z.infer<typeof NotificationTypeDto>;

export const NotificationResponseDto = z.object({
  id: publicId("ntf"),
  type: NotificationTypeDto,
  actor: UserSummaryDto,
  post_id: publicId("pst").nullable(),
  /** First media of the post (image url, or video url). */
  post_thumbnail_url: z.string().nullable(),
  comment_id: publicId("cmt").nullable(),
  /** Truncated to 100 chars. */
  comment_text: z.string().nullable(),
  read_at: IsoDateTime.nullable(),
  created_at: IsoDateTime,
});
export type NotificationResponseDto = z.infer<typeof NotificationResponseDto>;

/** Ordered `created_at DESC`. */
export const NotificationPageResponseDto = page(NotificationResponseDto);
export type NotificationPageResponseDto = z.infer<typeof NotificationPageResponseDto>;

export const MarkNotificationsReadRequestDto = z
  .object({
    /** `ntf_…`; marks this and all older notifications read. */
    up_to_id: publicId("ntf"),
  })
  .strict();
export type MarkNotificationsReadRequestDto = z.infer<typeof MarkNotificationsReadRequestDto>;

export const UnreadCountResponseDto = z.object({
  unread_count: z.number().int().nonnegative(),
});
export type UnreadCountResponseDto = z.infer<typeof UnreadCountResponseDto>;
