/**
 * Field limits shared by DTO schemas. Each value equals the DB `CHECK` in persistence/01-schema.md
 * and the domain constant in `apps/api/src/domain/shared/limits.ts` (asserted by a unit test).
 */
export const LIMITS = {
  usernameMin: 3,
  usernameMax: 30,
  emailMax: 254,
  passwordMin: 8,
  passwordMax: 128,
  loginMax: 254,
  loginPasswordMax: 128,
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
  jsonBodyBytesMax: 64 * 1024,
  userAgentMax: 255,
  pageLimitDefault: 20,
  pageLimitMax: 50,
  searchUsersQueryMax: 50,
  searchHashtagsQueryMax: 64,
  searchLimitDefault: 10,
  searchLimitMax: 30,
  storyTrayMax: 100,
  storyTtlMs: 24 * 60 * 60 * 1000,
  sseTicketTtlMs: 60_000,
} as const;

export type Limits = typeof LIMITS;
