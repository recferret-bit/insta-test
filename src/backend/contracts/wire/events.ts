import { z } from "zod";
import { publicId } from "./ids.ts";
import { NotificationResponseDto } from "./dto/notifications.ts";

/** SSE server events (internal-communication/02-domain-events-and-sse.md). Clients `safeParse` and drop invalid ones. */
export const NotificationCreatedEvent = z.object({
  type: z.literal("notification.created"),
  data: NotificationResponseDto,
});

export const NotificationUnreadCountEvent = z.object({
  type: z.literal("notification.unread_count"),
  data: z.object({ unread_count: z.number().int().nonnegative() }),
});

export const PostCountersEvent = z.object({
  type: z.literal("post.counters"),
  data: z.object({
    post_id: publicId("pst"),
    like_count: z.number().int().nonnegative(),
    comment_count: z.number().int().nonnegative(),
  }),
});

export const ServerEvent = z.discriminatedUnion("type", [
  NotificationCreatedEvent,
  NotificationUnreadCountEvent,
  PostCountersEvent,
]);
export type ServerEvent = z.infer<typeof ServerEvent>;
export type ServerEventType = ServerEvent["type"];

export const SERVER_EVENT_TYPES = ["notification.created", "notification.unread_count", "post.counters"] as const;

/** SSE timing constants. */
export const SSE = {
  retryMs: 5000,
  heartbeatMs: 25_000,
  ticketTtlMs: 60_000,
  maxConnectionsPerUser: 5,
  clientDedupeWindow: 200,
} as const;
