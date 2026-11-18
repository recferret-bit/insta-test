/**
 * Domain limits. Each value equals `LIMITS` in `packages/contracts/src/limits.ts` and the DB `CHECK`
 * constraints in `apps/api/migrations/0001_init.sql` (asserted by a unit test in `apps/api/test`).
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
  hashtagMax: 64,
  hashtagsPerPostMax: 30,
  postMediaMin: 1,
  postMediaMax: 10,
  commentMax: 500,
  notificationCommentTextMax: 100,
  mediaDimensionMax: 8192,
  videoDurationMsMax: 60_000,
  imageBytesMax: 10 * 1024 * 1024,
  videoBytesMax: 50 * 1024 * 1024,
  userAgentMax: 255,
  storyTrayMax: 100,
  storyTtlMs: 24 * 60 * 60 * 1000,
} as const;
