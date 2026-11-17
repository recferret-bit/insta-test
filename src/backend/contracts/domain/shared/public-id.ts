import { DomainError } from "./errors.ts";
import { UUID_PATTERN } from "./ids.ts";

/** Domain copy of the public ID prefixes (kept equal to wire ID_PREFIX by test/parity.test.ts). */
export const PUBLIC_ID_PREFIX = {
  user: "usr",
  session: "ses",
  media: "med",
  post: "pst",
  comment: "cmt",
  story: "sty",
  notification: "ntf",
} as const;

export type PublicIdPrefix = (typeof PUBLIC_ID_PREFIX)[keyof typeof PUBLIC_ID_PREFIX];

/** `toPublicId("usr", "0190f3c2-a1b4-7c3e-9d1f-2a3b4c5d6e7f")` → `usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f`. */
export function toPublicId(prefix: PublicIdPrefix, uuid: string): string {
  if (!UUID_PATTERN.test(uuid)) {
    throw new DomainError("INTERNAL", "Not a canonical UUID");
  }
  return `${prefix}_${uuid.replace(/-/g, "")}`;
}

/** Inverse of `toPublicId`; malformed or wrong-prefix input → `VALIDATION_FAILED`. */
export function parsePublicId<T extends string = string>(prefix: PublicIdPrefix, value: string): T {
  const match = new RegExp(`^${prefix}_([0-9a-f]{32})$`).exec(value);
  if (!match) {
    throw new DomainError("VALIDATION_FAILED", `Invalid ${prefix} id`, [{ path: "id", message: `Must be a ${prefix}_ id` }]);
  }
  const h = match[1]!;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` as T;
}
