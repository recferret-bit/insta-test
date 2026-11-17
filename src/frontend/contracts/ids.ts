// Public ID prefixes (DEC-04): `<prefix>_<32 hex>` on the wire.
// Source: docs/specs/internal-communication/01-shared-contracts.md (ids.ts).

export const ID_PREFIX = {
  user: "usr",
  session: "ses",
  media: "med",
  post: "pst",
  comment: "cmt",
  story: "sty",
  notification: "ntf",
} as const;

export type IdKind = keyof typeof ID_PREFIX;
export type IdPrefix = (typeof ID_PREFIX)[IdKind];

/** Branded-by-convention aliases; the wire type is always `string`. */
export type UserId = string;
export type MediaId = string;
export type PostId = string;
export type CommentId = string;
export type StoryId = string;
export type NotificationId = string;

const HEX32 = /^[0-9a-f]{32}$/;

/** True when `value` is a well-formed public ID of the given kind. */
export function isPublicId(kind: IdKind, value: unknown): value is string {
  if (typeof value !== "string") return false;
  const prefix = `${ID_PREFIX[kind]}_`;
  return value.startsWith(prefix) && HEX32.test(value.slice(prefix.length));
}
