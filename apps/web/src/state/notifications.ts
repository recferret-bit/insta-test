/**
 * Notification hooks — w00 stub used by the shell badge. w06 (`state/notifications*`) replaces the body with the
 * `["unreadCount"]` query fed by `GET /notifications/unread-count` and SSE `notification.unread_count`.
 */
/** Unread notification count for the nav badge (w00: always `0`). */
export function useUnreadCount(): number {
  return 0;
}

/** Badge text: `""` for 0, `"9+"` above 9. */
export function unreadBadgeLabel(count: number): string {
  if (count <= 0) return "";
  return count > 9 ? "9+" : String(count);
}
