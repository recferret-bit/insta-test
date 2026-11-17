/**
 * Wire-level field limits (F-ICOMM-01). Zod-free so the domain parity test can load it without dependencies.
 * Every value MUST equal the DB CHECK in db/migrations/0001_init.sql and DOMAIN_LIMITS in domain/shared/limits.ts.
 */
export const LIMITS = {
  usernameMin: 3,
  usernameMax: 30,
  emailMax: 254,
  passwordMin: 8,
  passwordMax: 128,
  loginMax: 254,
  fullNameMax: 60,
  bioMax: 150,
  bioMaxNewlines: 4,
  captionMax: 2200,
  hashtagsPerPostMax: 30,
  hashtagMax: 64,
  commentMax: 500,
  commentPreviewMax: 100,
  postMediaMin: 1,
  postMediaMax: 10,
  mediaDimensionMax: 8192,
  videoDurationMsMax: 60_000,
  imageBytesMax: 10 * 1024 * 1024,
  videoBytesMax: 50 * 1024 * 1024,
  jsonBodyBytesMax: 64 * 1024,
  userAgentMax: 255,
  pageLimitDefault: 20,
  pageLimitMax: 50,
  searchLimitDefault: 10,
  searchLimitMax: 30,
  userSearchQueryMax: 50,
  hashtagSearchQueryMax: 64,
  storyTrayMax: 100,
  accessTokenLength: 43,
} as const;

export type Limits = typeof LIMITS;

/** Lowercased username shape; leading/trailing '.' is rejected separately. */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export const MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"] as const;
export const MEDIA_KINDS = ["image", "video"] as const;
export const MEDIA_PURPOSES = ["post", "story", "avatar"] as const;
export const NOTIFICATION_TYPES = ["like", "comment", "follow"] as const;
