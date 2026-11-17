import { z } from "zod";
import { IsoDateTime, publicId } from "../ids.ts";
import { LIMITS, MEDIA_KINDS, MEDIA_MIME_TYPES, MEDIA_PURPOSES, USERNAME_PATTERN } from "../limits.ts";

export const MediaKindDto = z.enum(MEDIA_KINDS);
export const MediaPurposeDto = z.enum(MEDIA_PURPOSES);
export const MediaMimeTypeDto = z.enum(MEDIA_MIME_TYPES);

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
  width: z.number().int().min(1).max(LIMITS.mediaDimensionMax).nullable(),
  height: z.number().int().min(1).max(LIMITS.mediaDimensionMax).nullable(),
  duration_ms: z.number().int().min(1).max(LIMITS.videoDurationMsMax).nullable(),
  size_bytes: z.number().int().positive(),
  created_at: IsoDateTime,
});
export type MediaResponseDto = z.infer<typeof MediaResponseDto>;

/** Trimmed + lowercased username; `^[a-z0-9._]{3,30}$`, no leading/trailing '.'. Reserved names are a domain rule. */
export const UsernameInput = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "Username must be 3-30 characters of a-z, 0-9, '.', '_'")
  .refine((u) => !u.startsWith(".") && !u.endsWith("."), "Username cannot start or end with '.'");

export const EmailInput = z.string().trim().toLowerCase().max(LIMITS.emailMax).email();

/** Lowercased, trimmed username used in `/users/{username}` path params (case-insensitive lookup). */
export const UsernameParams = z
  .object({ username: z.string().trim().toLowerCase().min(1).max(LIMITS.usernameMax) })
  .strict();
export type UsernameParams = z.infer<typeof UsernameParams>;
