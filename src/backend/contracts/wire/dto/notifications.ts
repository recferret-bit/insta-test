import { z } from "zod";
import { IsoDateTime, publicId } from "../ids.ts";
import { LIMITS, NOTIFICATION_TYPES } from "../limits.ts";
import { UserSummaryDto } from "./common.ts";

export const NotificationTypeDto = z.enum(NOTIFICATION_TYPES);

export const NotificationResponseDto = z.object({
  id: publicId("ntf"),
  type: NotificationTypeDto,
  actor: UserSummaryDto,
  post_id: publicId("pst").nullable(),
  /** First media of the post (image or video URL). */
  post_thumbnail_url: z.string().nullable(),
  comment_id: publicId("cmt").nullable(),
  /** Truncated to 100 chars. */
  comment_text: z.string().max(LIMITS.commentPreviewMax).nullable(),
  read_at: IsoDateTime.nullable(),
  created_at: IsoDateTime,
});
export type NotificationResponseDto = z.infer<typeof NotificationResponseDto>;

/** Ordered `created_at DESC`. */
export const NotificationPageResponseDto = z.object({
  items: z.array(NotificationResponseDto),
  next_cursor: z.string().nullable(),
});
export type NotificationPageResponseDto = z.infer<typeof NotificationPageResponseDto>;

export const MarkNotificationsReadRequestDto = z
  .object({
    /** Marks this notification and all older ones read. */
    up_to_id: publicId("ntf"),
  })
  .strict();
export type MarkNotificationsReadRequestDto = z.infer<typeof MarkNotificationsReadRequestDto>;

export const UnreadCountResponseDto = z.object({
  unread_count: z.number().int().nonnegative(),
});
export type UnreadCountResponseDto = z.infer<typeof UnreadCountResponseDto>;
