/** Branded business IDs: canonical dashed UUIDv7 strings (backend/01-business-entities.md). */
export type Brand<T, B> = T & { readonly __brand: B };

export type UserId = Brand<string, "UserId">;
export type SessionId = Brand<string, "SessionId">;
export type MediaId = Brand<string, "MediaId">;
export type PostId = Brand<string, "PostId">;
export type CommentId = Brand<string, "CommentId">;
export type StoryId = Brand<string, "StoryId">;
export type NotificationId = Brand<string, "NotificationId">;

/** Canonical lowercase dashed UUID. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
