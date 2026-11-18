/** Notification endpoints — external-communication/06-feed-search-notifications-api.md. */
import {
  NotificationPageResponseDto,
  UnreadCountResponseDto,
  type MarkNotificationsReadRequestDto,
} from "@insta/contracts";

import { request, type InputOf, type PageParams } from "./http";

export type MarkNotificationsReadBody = InputOf<typeof MarkNotificationsReadRequestDto>;

/** `GET /notifications?cursor&limit` (newest first) → `200 NotificationPageResponseDto`. */
export function getNotifications(
  page: PageParams = {},
  signal?: AbortSignal,
): Promise<NotificationPageResponseDto> {
  return request("GET", "/notifications", { query: page, schema: NotificationPageResponseDto, signal });
}

/** `GET /notifications/unread-count` → `200 UnreadCountResponseDto`. */
export function getUnreadCount(signal?: AbortSignal): Promise<UnreadCountResponseDto> {
  return request("GET", "/notifications/unread-count", { schema: UnreadCountResponseDto, signal });
}

/** `POST /notifications/read` (`up_to_id` and everything older) → `200 UnreadCountResponseDto`. */
export function markNotificationsRead(
  body: MarkNotificationsReadBody,
  signal?: AbortSignal,
): Promise<UnreadCountResponseDto> {
  return request("POST", "/notifications/read", { body, schema: UnreadCountResponseDto, signal });
}
