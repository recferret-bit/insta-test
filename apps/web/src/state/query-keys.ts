/**
 * TanStack Query key factory & stale times (frontend/02-state-viewmodels-and-mappers.md#query-keys-tanstack-query).
 * Every cached value is a ViewModel (or a `PageViewModel` of ViewModels), never a raw DTO.
 */
const SECOND = 1000;
const MINUTE = 60 * SECOND;

export type FollowListKind = "followers" | "following";
export type SearchKind = "users" | "hashtags";

export const queryKeys = {
  me: () => ["me"] as const,
  feed: () => ["feed"] as const,
  explore: () => ["explore"] as const,
  post: (postId: string) => ["post", postId] as const,
  comments: (postId: string) => ["comments", postId] as const,
  profile: (username: string) => ["profile", username] as const,
  userPosts: (username: string) => ["userPosts", username] as const,
  followList: (kind: FollowListKind, username: string) => [kind, username] as const,
  storyTray: () => ["storyTray"] as const,
  userStories: (username: string) => ["userStories", username] as const,
  search: (kind: SearchKind, q: string) => ["search", kind, q] as const,
  hashtag: (tag: string) => ["hashtag", tag] as const,
  notifications: () => ["notifications"] as const,
  unreadCount: () => ["unreadCount"] as const,
} as const;

/** Stale time per key root (`Infinity` = only SSE events or explicit invalidation refresh it). */
export const STALE_TIMES = {
  me: 5 * MINUTE,
  feed: 30 * SECOND,
  explore: 60 * SECOND,
  post: 30 * SECOND,
  comments: 30 * SECOND,
  profile: 60 * SECOND,
  userPosts: 60 * SECOND,
  followers: 60 * SECOND,
  following: 60 * SECOND,
  storyTray: 30 * SECOND,
  userStories: 30 * SECOND,
  search: 60 * SECOND,
  hashtag: 60 * SECOND,
  notifications: 0,
  unreadCount: Number.POSITIVE_INFINITY,
} as const satisfies Record<string, number>;

export type QueryKeyRoot = keyof typeof STALE_TIMES;

/** Key roots whose cached data contain `PostViewModel`s (single or paged) — patched by `patchPostInCaches`. */
export const POST_CACHE_ROOTS = [
  "post",
  "feed",
  "explore",
  "userPosts",
  "hashtag",
] as const satisfies readonly QueryKeyRoot[];

/** Key roots whose cached data is a `ProfileViewModel` / `MeViewModel` — patched by `patchProfileInCaches`. */
export const PROFILE_CACHE_ROOTS = ["profile", "me"] as const satisfies readonly QueryKeyRoot[];
