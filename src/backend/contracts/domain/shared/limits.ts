/**
 * Domain limits. Must equal wire LIMITS (wire/limits.ts) and the DB CHECKs (db/migrations/0001_init.sql);
 * enforced by test/parity.test.ts.
 */
export const DOMAIN_LIMITS = {
  usernameMin: 3,
  usernameMax: 30,
  emailMax: 254,
  passwordMin: 8,
  passwordMax: 128,
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
  userAgentMax: 255,
} as const;

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_TTL_DAYS_DEFAULT = 30;
/** Unattached media older than this are purged by MediaCleanupJob. */
export const UNATTACHED_MEDIA_TTL_MS = 24 * 60 * 60 * 1000;

/** Usernames rejected at registration / rename (backend/01-business-entities.md). */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "api",
  "admin",
  "explore",
  "me",
  "login",
  "signup",
  "settings",
  "stories",
  "p",
  "u",
  "media",
  "notifications",
  "create",
]);

/** Hashtag extraction regex (global, unicode). Captured group 1 is the tag without '#'. */
export const HASHTAG_REGEX = /#([\p{L}\p{N}_]{1,64})/gu;
