# 02 — Migrations & Indexes

Features: `F-DB-02` (forward-only migrations), `F-DB-03` (index coverage).

## Migration Strategy

- Location: `apps/api/migrations/NNNN_<snake_case_name>.sql` — 4-digit, zero-padded, strictly increasing, no gaps.
- **Forward-only:** no down migrations. To undo, write a new migration. Applied files are immutable (checksum enforced).
- Runner: `apps/api/src/data/db/migrate.ts`, invoked by `npm run migrate -w apps/api` and automatically on API startup when `MIGRATE_ON_START=true` (default in compose).
  1. `SELECT pg_advisory_lock(hashtext('schema_migrations'))` (serializes concurrent starters).
  2. `CREATE TABLE IF NOT EXISTS schema_migrations (...)`.
  3. For each file in numeric order: if recorded → compare checksum, mismatch = fatal; else run file inside `BEGIN … COMMIT` and insert the record in the same tx.
  4. Release the lock. Any failure exits non-zero → container unhealthy.
- Files must be idempotent-safe only in the sense that they run once; avoid `CREATE INDEX CONCURRENTLY` (not allowed inside a tx) until data volume demands it (`Q-07`).
- Wave rule: each wave reserves migration numbers in its manifest so parallel tasks never collide.

## Initial Migration Plan

| File | Content |
|---|---|
| `0001_init.sql` | `CREATE EXTENSION IF NOT EXISTS pg_trgm;` all tables from [01-schema.md](./01-schema.md) in FK order (`users` → `sessions` → `media_assets` → `ALTER users ADD FK avatar_media_id` → `posts` → `post_media` → `post_hashtags` → `comments` → `post_likes` → `follows` → `stories` → `story_views` → `notifications`) plus all indexes below |


Dev seed data is **not** a migration: it lives in `apps/api/scripts/seed.ts` (`npm run seed -w apps/api`) and never runs automatically in CI or previews.

## Index Catalog

| Index | Definition | Serves |
|---|---|---|
| `users_username_key` | `UNIQUE (username)` | Profile lookup, login, uniqueness |
| `users_email_key` | `UNIQUE (email)` | Login by email, uniqueness |
| `users_username_prefix_idx` | `(username text_pattern_ops)` | User search prefix `username LIKE $q || '%'` |
| `users_username_trgm_idx` | `GIN (username gin_trgm_ops)` | User search fuzzy |
| `users_full_name_trgm_idx` | `GIN (lower(full_name) gin_trgm_ops)` | User search by name |
| `sessions_token_hash_key` | `UNIQUE (token_hash)` | Auth per request |
| `sessions_user_id_idx` | `(user_id)` | Cascade/cleanup |
| `media_assets_owner_id_idx` | `(owner_id)` | Ownership checks, cascade |
| `media_assets_unattached_idx` | `(created_at) WHERE status = 'uploaded'` | `MediaCleanupJob` |
| `posts_author_feed_idx` | `(author_id, created_at DESC, id DESC) WHERE deleted_at IS NULL` | Profile grid, home feed (`author_id = ANY(...)` merge) |
| `posts_recent_idx` | `(created_at DESC, id DESC) WHERE deleted_at IS NULL` | Explore |
| `post_media_media_id_key` | `UNIQUE (media_id)` | One post per media (`INV-03`) |
| `post_hashtags_tag_idx` | `(tag text_pattern_ops, post_id)` | Hashtag prefix search & hashtag post list |
| `comments_post_idx` | `(post_id, created_at, id) WHERE deleted_at IS NULL` | Comment list |
| `comments_author_id_idx` | `(author_id)` | Cascade |
| `post_likes_user_id_idx` | `(user_id)` | Cascade, `viewer_has_liked` probes use PK |
| `post_likes_post_recent_idx` | `(post_id, created_at DESC)` | Likers list |
| `follows_followee_idx` | `(followee_id, created_at DESC)` | Followers list |
| `follows_follower_idx` | `(follower_id, created_at DESC)` | Following list, feed followee set |
| `stories_author_active_idx` | `(author_id, expires_at)` | Tray, user stories |
| `stories_expires_at_idx` | `(expires_at)` | `StoryCleanupJob` |
| `story_views_story_idx` | `(story_id, viewed_at DESC)` | Viewer list, view count |
| `notifications_recipient_idx` | `(recipient_id, created_at DESC, id DESC)` | Notification list |
| `notifications_unread_idx` | `(recipient_id) WHERE read_at IS NULL` | Unread count |
| `notifications_like_uq` | `UNIQUE (recipient_id, actor_id, post_id) WHERE type = 'like'` | Dedupe |
| `notifications_follow_uq` | `UNIQUE (recipient_id, actor_id) WHERE type = 'follow'` | Dedupe |
| `notifications_actor_id_idx` | `(actor_id)` | Cascade |

## Key Queries (reference SQL)

```sql
-- Home feed page (DEC-09, DEC-10)
SELECT p.* FROM posts p
WHERE p.deleted_at IS NULL
  AND (p.author_id = $viewer OR p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $viewer))
  AND ($cursor_t IS NULL OR (p.created_at, p.id) < ($cursor_t, $cursor_id))
ORDER BY p.created_at DESC, p.id DESC
LIMIT $limit + 1;   -- extra row determines next_cursor

-- Counter update (DEC-11)
UPDATE posts SET like_count = like_count + 1 WHERE id = $1 RETURNING like_count, comment_count;
```

Post views are assembled with a second query fetching `post_media ⋈ media_assets`, `post_hashtags`, authors, and `viewer_has_liked` for the page's post IDs (`= ANY($ids)`), avoiding N+1.
