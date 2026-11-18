import { z } from "zod";

import { NotificationResponseDto, UnreadCountResponseDto } from "./dto/notifications.js";
import { publicId } from "./ids.js";

/**
 * Server → browser SSE events (internal-communication/02-domain-events-and-sse.md#server-events).
 * The SSE `data:` line carries one `ServerEvent` as JSON; clients `safeParse` and drop invalid ones.
 */
export const NotificationCreatedEvent = z.object({
  type: z.literal("notification.created"),
  data: NotificationResponseDto,
});
export type NotificationCreatedEvent = z.infer<typeof NotificationCreatedEvent>;

export const NotificationUnreadCountEvent = z.object({
  type: z.literal("notification.unread_count"),
  data: UnreadCountResponseDto,
});
export type NotificationUnreadCountEvent = z.infer<typeof NotificationUnreadCountEvent>;

export const PostCountersEvent = z.object({
  type: z.literal("post.counters"),
  data: z.object({
    post_id: publicId("pst"),
    like_count: z.number().int().nonnegative(),
    comment_count: z.number().int().nonnegative(),
  }),
});
export type PostCountersEvent = z.infer<typeof PostCountersEvent>;

export const ServerEvent = z.discriminatedUnion("type", [
  NotificationCreatedEvent,
  NotificationUnreadCountEvent,
  PostCountersEvent,
]);
export type ServerEvent = z.infer<typeof ServerEvent>;
export type ServerEventType = ServerEvent["type"];

export const SERVER_EVENT_TYPES = [
  "notification.created",
  "notification.unread_count",
  "post.counters",
] as const satisfies readonly ServerEventType[];
