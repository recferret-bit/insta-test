/**
 * Database entity row types (persistence/03-row-mappers.md); target home: apps/api/src/data/rows/<module>.row.ts.
 * They mirror db/migrations/0001_init.sql columns exactly (snake_case). `pg` returns timestamptz as Date,
 * uuid as string, bigint as string, bytea as Buffer, smallint/integer as number.
 */

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

export type SessionRow = {
  id: string;
  user_id: string;
  token_hash: Buffer;
  user_agent: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
};

export type MediaAssetRow = {
  id: string;
  owner_id: string;
  purpose: "post" | "story" | "avatar";
  kind: "image" | "video";
  mime_type: string;
  storage_key: string;
  byte_size: string; // bigint
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  status: "uploaded" | "attached";
  created_at: Date;
};

export type PostRow = {
  id: string;
  author_id: string;
  caption: string;
  like_count: number;
  comment_count: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type PostMediaRow = { post_id: string; media_id: string; position: number };
export type PostHashtagRow = { post_id: string; tag: string; position: number };

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  text: string;
  created_at: Date;
  deleted_at: Date | null;
};

export type PostLikeRow = { post_id: string; user_id: string; created_at: Date };
export type FollowRow = { follower_id: string; followee_id: string; created_at: Date };
export type StoryRow = { id: string; author_id: string; media_id: string; created_at: Date; expires_at: Date };
export type StoryViewRow = { story_id: string; viewer_id: string; viewed_at: Date };

export type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: "like" | "comment" | "follow";
  post_id: string | null;
  comment_id: string | null;
  created_at: Date;
  read_at: Date | null;
};

export type SchemaMigrationRow = { version: number; name: string; checksum: string; applied_at: Date };

/**
 * Table → column list, in migration order. Used by test/schema.test.ts to keep the row types
 * and 0001_init.sql in sync, and reusable by an information_schema integration test.
 */
export const TABLE_COLUMNS = {
  users: [
    "id", "username", "email", "password_hash", "full_name", "bio", "avatar_media_id",
    "posts_count", "followers_count", "following_count", "created_at", "updated_at",
  ],
  sessions: ["id", "user_id", "token_hash", "user_agent", "created_at", "expires_at", "revoked_at"],
  media_assets: [
    "id", "owner_id", "purpose", "kind", "mime_type", "storage_key", "byte_size",
    "width", "height", "duration_ms", "status", "created_at",
  ],
  posts: ["id", "author_id", "caption", "like_count", "comment_count", "created_at", "updated_at", "deleted_at"],
  post_media: ["post_id", "media_id", "position"],
  post_hashtags: ["post_id", "tag", "position"],
  comments: ["id", "post_id", "author_id", "text", "created_at", "deleted_at"],
  post_likes: ["post_id", "user_id", "created_at"],
  follows: ["follower_id", "followee_id", "created_at"],
  stories: ["id", "author_id", "media_id", "created_at", "expires_at"],
  story_views: ["story_id", "viewer_id", "viewed_at"],
  notifications: ["id", "recipient_id", "actor_id", "type", "post_id", "comment_id", "created_at", "read_at"],
} as const satisfies Record<string, readonly string[]>;

/** Compile-time check that each row type has exactly the listed columns. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type AllTrue<T extends readonly true[]> = T;
type Cols<T extends keyof typeof TABLE_COLUMNS> = (typeof TABLE_COLUMNS)[T][number];
export type _RowColumnsMatch = AllTrue<[
  Exact<keyof UserRow, Cols<"users">>,
  Exact<keyof SessionRow, Cols<"sessions">>,
  Exact<keyof MediaAssetRow, Cols<"media_assets">>,
  Exact<keyof PostRow, Cols<"posts">>,
  Exact<keyof PostMediaRow, Cols<"post_media">>,
  Exact<keyof PostHashtagRow, Cols<"post_hashtags">>,
  Exact<keyof CommentRow, Cols<"comments">>,
  Exact<keyof PostLikeRow, Cols<"post_likes">>,
  Exact<keyof FollowRow, Cols<"follows">>,
  Exact<keyof StoryRow, Cols<"stories">>,
  Exact<keyof StoryViewRow, Cols<"story_views">>,
  Exact<keyof NotificationRow, Cols<"notifications">>,
]>;
