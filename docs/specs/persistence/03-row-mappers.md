# 03 — Row Types & Row ↔ Business Entity Mappers

Feature: `F-DB-04`. Location: `apps/api/src/data/rows/<module>.row.ts` and `apps/api/src/data/mappers/<module>.row-mapper.ts`.

## General Rules

- `pg` returns `timestamptz` as `Date`, `uuid` as `string`, `bigint` as `string` (parse with `Number()` — sizes < 2^53), `bytea` as `Buffer`, `smallint`/`integer` as `number`.
- Row types mirror columns exactly (`snake_case`). Mappers are pure functions, no I/O.
- `mapXRowToEntity` brands IDs (`as UserId`) and builds nested value objects; `mapXEntityToRow` flattens them.
- Read models (`*View`) are mapped from **query result rows** (`*ViewRow`) that include joined columns with explicit aliases (e.g. `author_username`).
- Every mapper pair has a round-trip unit test: `mapXRowToEntity(mapXEntityToRow(e))` deep-equals `e`.

## Row Types

```ts
type UserRow = {
  id: string; username: string; email: string; password_hash: string;
  full_name: string; bio: string; avatar_media_id: string | null;
  posts_count: number; followers_count: number; following_count: number;
  created_at: Date; updated_at: Date;
};
type SessionRow = {
  id: string; user_id: string; token_hash: Buffer; user_agent: string;
  created_at: Date; expires_at: Date; revoked_at: Date | null;
};
type MediaAssetRow = {
  id: string; owner_id: string; purpose: "post" | "story" | "avatar"; kind: "image" | "video";
  mime_type: string; storage_key: string; byte_size: string;   // bigint
  width: number | null; height: number | null; duration_ms: number | null;
  status: "uploaded" | "attached"; created_at: Date;
};
type PostRow = {
  id: string; author_id: string; caption: string; like_count: number; comment_count: number;
  created_at: Date; updated_at: Date; deleted_at: Date | null;
};
type PostMediaRow = { post_id: string; media_id: string; position: number };
type PostHashtagRow = { post_id: string; tag: string; position: number };
type CommentRow = { id: string; post_id: string; author_id: string; text: string; created_at: Date; deleted_at: Date | null };
type PostLikeRow = { post_id: string; user_id: string; created_at: Date };
type FollowRow = { follower_id: string; followee_id: string; created_at: Date };
type StoryRow = { id: string; author_id: string; media_id: string; created_at: Date; expires_at: Date };
type StoryViewRow = { story_id: string; viewer_id: string; viewed_at: Date };
type NotificationRow = {
  id: string; recipient_id: string; actor_id: string; type: "like" | "comment" | "follow";
  post_id: string | null; comment_id: string | null; created_at: Date; read_at: Date | null;
};
```

## Mapper Catalog

| Entity | Row → Entity | Entity → Row | Notes |
|---|---|---|---|
| `ENT-User` | `mapUserRowToEntity(row): User` | `mapUserEntityToRow(user): UserRow` | `stats` ↔ three `*_count` columns |
| `ENT-User` (view) | `mapUserSummaryViewRow(row, prefix)` / `mapUserProfileViewRow(row)` | — | `prefix` selects aliased columns (`author_`, `actor_`, …); `avatar_storage_key` joined from `media_assets` |
| `ENT-Session` | `mapSessionRowToEntity` | `mapSessionEntityToRow` | `token_hash` Buffer passthrough |
| `ENT-Media` | `mapMediaRowToEntity` | `mapMediaEntityToRow` | `byte_size` string ↔ number |
| `ENT-Post` | `mapPostRowsToEntity(post, media[], tags[])` | `mapPostEntityToRows(post) → { post, media[], hashtags[] }` | `media` sorted by `position`; `hashtags` sorted by `position` |
| `ENT-Post` (view) | `mapPostViewRows(postRow, author, media[], tags[], viewerHasLiked)` | — | Assembled per page |
| `ENT-Comment` | `mapCommentRowToEntity` | `mapCommentEntityToRow` | — |
| `ENT-Like` | `mapPostLikeRowToEntity` | `mapLikeEntityToRow` | — |
| `ENT-Follow` | `mapFollowRowToEntity` | `mapFollowEntityToRow` | — |
| `ENT-Story` | `mapStoryRowToEntity` | `mapStoryEntityToRow` | — |
| `ENT-StoryView` | `mapStoryViewRowToEntity` → `StorySeen` | `mapStorySeenEntityToRow` | — |
| `ENT-Notification` | `mapNotificationRowToEntity` | `mapNotificationEntityToRow` | View adds `actor_*`, `post_thumbnail_storage_key`, `comment_text` |

## Error Translation (repositories)

| `pg` code | Constraint | Domain error |
|---|---|---|
| `23505` | `users_username_key` | `USERNAME_TAKEN` |
| `23505` | `users_email_key` | `EMAIL_TAKEN` |
| `23505` | `post_media_media_id_key`, `stories_media_id_key` | `MEDIA_INVALID` |
| `23514` | `follows_check` (self-follow) | `CANNOT_FOLLOW_SELF` |
| `23503` | any FK on insert | `NOT_FOUND` |
| other | — | rethrown → `INTERNAL` |
