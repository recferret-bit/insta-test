/**
 * Branded identifier types (backend/01-business-entities.md#shared-types).
 * Every ID is a canonical dashed UUID (UUIDv7, `DEC-04`); the brand prevents mixing kinds.
 * Conversion to/from public `<prefix>_<hex>` IDs happens only in `api/` mappers.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, "UserId">;
export type SessionId = Brand<string, "SessionId">;
export type MediaId = Brand<string, "MediaId">;
export type PostId = Brand<string, "PostId">;
export type CommentId = Brand<string, "CommentId">;
export type StoryId = Brand<string, "StoryId">;
export type NotificationId = Brand<string, "NotificationId">;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** True for a lowercase canonical dashed UUID. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
