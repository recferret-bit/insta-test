// SSE server events. Source: docs/specs/internal-communication/02-domain-events-and-sse.md.
import type { NotificationResponseDto } from "./dto/discovery.ts";
import type { PostId } from "./ids.ts";

export type ServerEvent =
  | { type: "notification.created"; data: NotificationResponseDto }
  | { type: "notification.unread_count"; data: { unread_count: number } }
  | { type: "post.counters"; data: { post_id: PostId; like_count: number; comment_count: number } };

export type ServerEventType = ServerEvent["type"];

export const SERVER_EVENT_TYPES: readonly ServerEventType[] = [
  "notification.created",
  "notification.unread_count",
  "post.counters",
];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

/**
 * Shallow structural parse of an SSE `MessageEvent.data` string.
 * Returns null for malformed JSON or unknown/invalid events (client drops them).
 * Full schema validation is done with `@insta/contracts` `ServerEvent.safeParse` once available.
 */
export function parseServerEvent(raw: string): ServerEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(value) || !isObj(value.data)) return null;
  const d = value.data;
  switch (value.type) {
    case "notification.created":
      return typeof d.id === "string" && typeof d.type === "string" && isObj(d.actor)
        ? (value as ServerEvent)
        : null;
    case "notification.unread_count":
      return isCount(d.unread_count) ? (value as ServerEvent) : null;
    case "post.counters":
      return typeof d.post_id === "string" && isCount(d.like_count) && isCount(d.comment_count)
        ? (value as ServerEvent)
        : null;
    default:
      return null;
  }
}
