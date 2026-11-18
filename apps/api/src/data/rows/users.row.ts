/* Database Entity — mirrors the table columns exactly (persistence/03-row-mappers.md#row-types). */

/** `users` */
export type UserRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  bio: string;
  avatar_media_id: string | null;
  posts_count: number;
  followers_count: number;
  following_count: number;
  created_at: Date;
  updated_at: Date;
};

/** Columns of an embedded user summary in a query result (`users` + `media_assets.storage_key` + follow `EXISTS`). */
export type UserSummaryColumns = {
  id: string;
  username: string;
  full_name: string;
  /** `media_assets.storage_key` of `users.avatar_media_id` (LEFT JOIN). */
  avatar_storage_key: string | null;
  /** `EXISTS` on `follows` for the viewer; `NULL` when anonymous or self. */
  is_following: boolean | null;
};

/**
 * Query result row for `UserSummaryView` with aliased columns, e.g. prefix `author_` →
 * `author_id`, `author_username`, `author_full_name`, `author_avatar_storage_key`, `author_is_following`.
 */
export type UserSummaryViewRow<P extends string = ""> = {
  [K in keyof UserSummaryColumns as `${P}${K}`]: UserSummaryColumns[K];
};

/** Query result row for `UserProfileView` (`GET /users/{username}`, `GET /me`). */
export type UserProfileViewRow = UserSummaryViewRow & {
  bio: string;
  posts_count: number;
  followers_count: number;
  following_count: number;
  /** `EXISTS` on `stories` with `expires_at > now()`. */
  has_active_story: boolean;
  created_at: Date;
  /** Selected only for the viewer's own profile (`CASE WHEN id = $viewer THEN email END`), else `NULL`. */
  email: string | null;
};
