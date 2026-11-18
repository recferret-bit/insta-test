import type { Email, PasswordHash, User, Username } from "../../domain/identity/user.entity.js";
import type { UserProfileView, UserSummaryView } from "../../domain/identity/views.js";
import type { MediaId, UserId } from "../../domain/shared/ids.js";
import type {
  UserProfileViewRow,
  UserRow,
  UserSummaryColumns,
  UserSummaryViewRow,
} from "../rows/users.row.js";

/** `ENT-User` Row → Business Entity; three `*_count` columns → `stats` (persistence/03-row-mappers.md). */
export function mapUserRowToEntity(row: UserRow): User {
  return {
    id: row.id as UserId,
    username: row.username as Username,
    email: row.email as Email,
    passwordHash: row.password_hash as PasswordHash,
    fullName: row.full_name,
    bio: row.bio,
    avatarMediaId: row.avatar_media_id as MediaId | null,
    stats: { posts: row.posts_count, followers: row.followers_count, following: row.following_count },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** `ENT-User` Business Entity → Row; `stats` flattened into the `*_count` columns. */
export function mapUserEntityToRow(user: User): UserRow {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    password_hash: user.passwordHash,
    full_name: user.fullName,
    bio: user.bio,
    avatar_media_id: user.avatarMediaId,
    posts_count: user.stats.posts,
    followers_count: user.stats.followers,
    following_count: user.stats.following,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

/**
 * Aliased query columns → `UserSummaryView`. `prefix` selects the column group (`""`, `author_`, `actor_`, …),
 * e.g. `mapUserSummaryViewRow(row, "author_")` reads `author_id`, `author_username`, ….
 */
export function mapUserSummaryViewRow<P extends string>(
  row: UserSummaryViewRow<P>,
  prefix: P,
): UserSummaryView {
  const cols = row as unknown as Record<string, unknown>;
  const col = <K extends keyof UserSummaryColumns>(key: K): UserSummaryColumns[K] =>
    cols[`${prefix}${key}`] as UserSummaryColumns[K];
  return {
    id: col("id") as UserId,
    username: col("username") as Username,
    fullName: col("full_name"),
    avatarStorageKey: col("avatar_storage_key"),
    viewerIsFollowing: col("is_following"),
  };
}

/** Profile query row → `UserProfileView`; `email` only present when the query selected it (own profile). */
export function mapUserProfileViewRow(row: UserProfileViewRow): UserProfileView {
  const view: UserProfileView = {
    ...mapUserSummaryViewRow(row, ""),
    bio: row.bio,
    stats: { posts: row.posts_count, followers: row.followers_count, following: row.following_count },
    hasActiveStory: row.has_active_story,
    createdAt: row.created_at,
  };
  if (row.email !== null) view.email = row.email as Email;
  return view;
}
