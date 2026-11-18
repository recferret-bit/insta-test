import { z } from "zod";

import { publicId } from "../ids.js";
import { LIMITS } from "../limits.js";

/** ISO-8601 UTC timestamp with `Z` and milliseconds, e.g. `2026-11-17T10:00:00.000Z`. */
export const IsoDateTime = z.string().datetime({ precision: 3 });

export const MEDIA_KINDS = ["image", "video"] as const;
export const MediaKindDto = z.enum(MEDIA_KINDS);
export type MediaKindDto = z.infer<typeof MediaKindDto>;

export const MEDIA_PURPOSES = ["post", "story", "avatar"] as const;
export const MediaPurposeDto = z.enum(MEDIA_PURPOSES);
export type MediaPurposeDto = z.infer<typeof MediaPurposeDto>;

export const MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"] as const;
export const MediaMimeTypeDto = z.enum(MEDIA_MIME_TYPES);
export type MediaMimeTypeDto = z.infer<typeof MediaMimeTypeDto>;

const USERNAME_CHARS = /^[a-z0-9._]+$/;

/** Request field: trimmed, lowercased, 3–30 of `[a-z0-9._]`, no leading/trailing `.`. Reserved names are a domain rule. */
export const UsernameField = z
  .string()
  .trim()
  .toLowerCase()
  .min(LIMITS.usernameMin)
  .max(LIMITS.usernameMax)
  .regex(USERNAME_CHARS, { message: "Only letters, digits, '.' and '_' are allowed" })
  .refine((u) => !u.startsWith(".") && !u.endsWith("."), {
    message: "Must not start or end with '.'",
  });

/** Path param `{username}`: lowercased before lookup (case-insensitive), format checked loosely. */
export const UsernameParam = z.string().trim().toLowerCase().min(1).max(LIMITS.usernameMax);

export const EmailField = z.string().trim().toLowerCase().max(LIMITS.emailMax).email();

export const FullNameField = z.string().trim().max(LIMITS.fullNameMax);

export const BioField = z
  .string()
  .max(LIMITS.bioMax)
  .refine((b) => (b.match(/\n/g)?.length ?? 0) <= LIMITS.bioMaxNewlines, {
    message: `At most ${LIMITS.bioMaxNewlines} line breaks are allowed`,
  });

export const UserSummaryDto = z.object({
  id: publicId("usr"),
  username: z.string(),
  full_name: z.string(),
  avatar_url: z.string().nullable(),
  /** `null` when anonymous or self. */
  is_following: z.boolean().nullable(),
});
export type UserSummaryDto = z.infer<typeof UserSummaryDto>;

export const MediaResponseDto = z.object({
  id: publicId("med"),
  kind: MediaKindDto,
  purpose: MediaPurposeDto,
  mime_type: z.string(),
  url: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  duration_ms: z.number().int().nullable(),
  size_bytes: z.number().int().nonnegative(),
  created_at: IsoDateTime,
});
export type MediaResponseDto = z.infer<typeof MediaResponseDto>;
