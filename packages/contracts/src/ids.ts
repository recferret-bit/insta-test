import { z } from "zod";

/**
 * Public ID prefixes (`F-CORE-04`, `DEC-04`). Wire IDs are `<prefix>_<32 lowercase hex>`;
 * the database and the domain use the canonical dashed UUID.
 */
export const ID_PREFIX = {
  user: "usr",
  session: "ses",
  media: "med",
  post: "pst",
  comment: "cmt",
  story: "sty",
  notification: "ntf",
} as const;

export type IdPrefix = (typeof ID_PREFIX)[keyof typeof ID_PREFIX];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Regex that a public ID with the given prefix must match: `^<prefix>_[0-9a-f]{32}$`. */
export function publicIdPattern(prefix: IdPrefix): RegExp {
  return new RegExp(`^${prefix}_[0-9a-f]{32}$`);
}

/** Zod schema for a public ID with the given prefix (validation only; no transformation). */
export function publicId(prefix: IdPrefix) {
  return z.string().regex(publicIdPattern(prefix), { message: `Must be a valid ${prefix}_ identifier` });
}

/**
 * Converts a canonical UUID to its public form: strips dashes, lowercases, prepends `<prefix>_`.
 * Throws `TypeError` for a value that is not a UUID (a programming error, never user input).
 */
export function toPublicId(prefix: IdPrefix, uuid: string): string {
  if (!UUID_PATTERN.test(uuid)) {
    throw new TypeError(`toPublicId: not a UUID: ${JSON.stringify(uuid)}`);
  }
  return `${prefix}_${uuid.replace(/-/g, "").toLowerCase()}`;
}

/**
 * Converts a public ID back to a canonical dashed UUID.
 * Returns `null` when the prefix or format does not match; the API layer turns that into
 * `400 VALIDATION_FAILED` (see `parsePublicId` in `apps/api/src/api`).
 */
export function fromPublicId(prefix: IdPrefix, value: string): string | null {
  if (!publicIdPattern(prefix).test(value)) return null;
  const hex = value.slice(prefix.length + 1);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
