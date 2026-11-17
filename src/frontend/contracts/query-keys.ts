// TanStack Query keys + stale times. Source: docs/specs/frontend/02-state-viewmodels-and-mappers.md.

export const queryKeys = {
  me: () => ["me"] as const,
  feed: () => ["feed"] as const,
  explore: () => ["explore"] as const,
  post: (postId: string) => ["post", postId] as const,
  comments: (postId: string) => ["comments", postId] as const,
  profile: (username: string) => ["profile", username] as const,
  userPosts: (username: string) => ["userPosts", username] as const,
  followers: (username: string) => ["followers", username] as const,
  following: (username: string) => ["following", username] as const,
  storyTray: () => ["storyTray"] as const,
  userStories: (username: string) => ["userStories", username] as const,
  search: (kind: "users" | "hashtags", q: string) => ["search", kind, q] as const,
  hashtag: (tag: string) => ["hashtag", tag] as const,
  notifications: () => ["notifications"] as const,
  unreadCount: () => ["unreadCount"] as const,
} as const;

export type QueryKeyName = keyof typeof queryKeys;

const SEC = 1000;
const MIN = 60 * SEC;

/** Stale time per key family (ms). `Infinity` = only SSE/mutations update it. */
export const STALE_TIME_MS: Record<QueryKeyName, number> = {
  me: 5 * MIN,
  feed: 30 * SEC,
  explore: 60 * SEC,
  post: 30 * SEC,
  comments: 30 * SEC,
  profile: 60 * SEC,
  userPosts: 60 * SEC,
  followers: 60 * SEC,
  following: 60 * SEC,
  storyTray: 30 * SEC,
  userStories: 30 * SEC,
  search: 60 * SEC,
  hashtag: 60 * SEC,
  notifications: 0,
  unreadCount: Number.POSITIVE_INFINITY,
};

/** Infinite (cursor-paginated) query families. */
export const INFINITE_QUERY_KEYS: readonly QueryKeyName[] = [
  "feed",
  "explore",
  "comments",
  "userPosts",
  "followers",
  "following",
  "hashtag",
  "notifications",
];

/** localStorage key for the persisted session (DEC-08). */
export const SESSION_STORAGE_KEY = "insta.session";
