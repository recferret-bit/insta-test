-- 0001_init.sql — schema v1 (F-DB-01, F-DB-02, F-DB-03)
-- Source of truth: docs/specs/persistence/01-schema.md and 02-migrations-and-indexes.md.
-- Forward-only: never edit this file after it has been applied (checksum enforced by the runner).
-- The runner wraps this file in BEGIN … COMMIT and owns the schema_migrations table, so neither appears here.
-- FK order: users → sessions → media_assets → users.avatar_media_id FK → posts → post_media → post_hashtags
--           → comments → post_likes → follows → stories → story_views → notifications.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- users (ENT-User)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id               uuid        PRIMARY KEY,
  username         text        NOT NULL,
  email            text        NOT NULL,
  password_hash    text        NOT NULL,
  full_name        text        NOT NULL DEFAULT '',
  bio              text        NOT NULL DEFAULT '',
  avatar_media_id  uuid        NULL,
  posts_count      integer     NOT NULL DEFAULT 0,
  followers_count  integer     NOT NULL DEFAULT 0,
  following_count  integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_username_key UNIQUE (username),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_username_check CHECK (username ~ '^[a-z0-9._]{3,30}$'),
  CONSTRAINT users_email_check CHECK (email = lower(email) AND char_length(email) <= 254),
  CONSTRAINT users_full_name_check CHECK (char_length(full_name) <= 60),
  CONSTRAINT users_bio_check CHECK (char_length(bio) <= 150),
  CONSTRAINT users_posts_count_check CHECK (posts_count >= 0),
  CONSTRAINT users_followers_count_check CHECK (followers_count >= 0),
  CONSTRAINT users_following_count_check CHECK (following_count >= 0)
);

CREATE INDEX users_username_prefix_idx ON users (username text_pattern_ops);
CREATE INDEX users_username_trgm_idx ON users USING gin (username gin_trgm_ops);
CREATE INDEX users_full_name_trgm_idx ON users USING gin (lower(full_name) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- sessions (ENT-Session)
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
  id          uuid        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  bytea       NOT NULL,
  user_agent  text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz NULL,
  CONSTRAINT sessions_token_hash_key UNIQUE (token_hash),
  CONSTRAINT sessions_token_hash_check CHECK (octet_length(token_hash) = 32),
  CONSTRAINT sessions_user_agent_check CHECK (char_length(user_agent) <= 255),
  CONSTRAINT sessions_expires_at_check CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- ---------------------------------------------------------------------------
-- media_assets (ENT-Media)
-- ---------------------------------------------------------------------------
CREATE TABLE media_assets (
  id           uuid        PRIMARY KEY,
  owner_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose      text        NOT NULL,
  kind         text        NOT NULL,
  mime_type    text        NOT NULL,
  storage_key  text        NOT NULL,
  byte_size    bigint      NOT NULL,
  width        integer     NULL,
  height       integer     NULL,
  duration_ms  integer     NULL,
  status       text        NOT NULL DEFAULT 'uploaded',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_assets_storage_key_key UNIQUE (storage_key),
  CONSTRAINT media_assets_purpose_check CHECK (purpose IN ('post', 'story', 'avatar')),
  CONSTRAINT media_assets_kind_check CHECK (kind IN ('image', 'video')),
  CONSTRAINT media_assets_avatar_kind_check CHECK (purpose <> 'avatar' OR kind = 'image'),
  CONSTRAINT media_assets_mime_type_check
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm')),
  CONSTRAINT media_assets_byte_size_check CHECK (byte_size > 0),
  CONSTRAINT media_assets_width_check CHECK (width BETWEEN 1 AND 8192),
  CONSTRAINT media_assets_height_check CHECK (height BETWEEN 1 AND 8192),
  CONSTRAINT media_assets_duration_ms_check CHECK (duration_ms BETWEEN 1 AND 60000),
  CONSTRAINT media_assets_duration_kind_check CHECK (kind = 'video' OR duration_ms IS NULL),
  CONSTRAINT media_assets_status_check CHECK (status IN ('uploaded', 'attached'))
);

CREATE INDEX media_assets_owner_id_idx ON media_assets (owner_id);
CREATE INDEX media_assets_unattached_idx ON media_assets (created_at) WHERE status = 'uploaded';

-- users.avatar_media_id needs media_assets to exist first.
ALTER TABLE users
  ADD CONSTRAINT users_avatar_media_id_fkey
  FOREIGN KEY (avatar_media_id) REFERENCES media_assets (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- posts, post_media, post_hashtags (ENT-Post)
-- ---------------------------------------------------------------------------
CREATE TABLE posts (
  id             uuid        PRIMARY KEY,
  author_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  caption        text        NOT NULL DEFAULT '',
  like_count     integer     NOT NULL DEFAULT 0,
  comment_count  integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz NULL,
  CONSTRAINT posts_caption_check CHECK (char_length(caption) <= 2200),
  CONSTRAINT posts_like_count_check CHECK (like_count >= 0),
  CONSTRAINT posts_comment_count_check CHECK (comment_count >= 0)
);

CREATE INDEX posts_author_feed_idx ON posts (author_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX posts_recent_idx ON posts (created_at DESC, id DESC) WHERE deleted_at IS NULL;

CREATE TABLE post_media (
  post_id   uuid     NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  media_id  uuid     NOT NULL REFERENCES media_assets (id) ON DELETE RESTRICT,
  position  smallint NOT NULL,
  CONSTRAINT post_media_pkey PRIMARY KEY (post_id, position),
  CONSTRAINT post_media_media_id_key UNIQUE (media_id),
  CONSTRAINT post_media_position_check CHECK (position BETWEEN 0 AND 9)
);

CREATE TABLE post_hashtags (
  post_id   uuid     NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  tag       text     NOT NULL,
  position  smallint NOT NULL,
  CONSTRAINT post_hashtags_pkey PRIMARY KEY (post_id, tag),
  CONSTRAINT post_hashtags_tag_check CHECK (tag = lower(tag) AND char_length(tag) BETWEEN 1 AND 64)
);

CREATE INDEX post_hashtags_tag_idx ON post_hashtags (tag text_pattern_ops, post_id);

-- ---------------------------------------------------------------------------
-- comments (ENT-Comment)
-- ---------------------------------------------------------------------------
CREATE TABLE comments (
  id          uuid        PRIMARY KEY,
  post_id     uuid        NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  author_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  text        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL,
  CONSTRAINT comments_text_check CHECK (char_length(text) BETWEEN 1 AND 500)
);

CREATE INDEX comments_post_idx ON comments (post_id, created_at, id) WHERE deleted_at IS NULL;
CREATE INDEX comments_author_id_idx ON comments (author_id);

-- ---------------------------------------------------------------------------
-- post_likes (ENT-Like)
-- ---------------------------------------------------------------------------
CREATE TABLE post_likes (
  post_id     uuid        NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id)
);

CREATE INDEX post_likes_user_id_idx ON post_likes (user_id);
CREATE INDEX post_likes_post_recent_idx ON post_likes (post_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- follows (ENT-Follow)
-- ---------------------------------------------------------------------------
CREATE TABLE follows (
  follower_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  followee_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follows_pkey PRIMARY KEY (follower_id, followee_id),
  -- Name referenced by the repository error translation (persistence/03: 23514 follows_check → CANNOT_FOLLOW_SELF).
  CONSTRAINT follows_check CHECK (follower_id <> followee_id)
);

CREATE INDEX follows_followee_idx ON follows (followee_id, created_at DESC);
CREATE INDEX follows_follower_idx ON follows (follower_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- stories (ENT-Story)
-- ---------------------------------------------------------------------------
CREATE TABLE stories (
  id          uuid        PRIMARY KEY,
  author_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  media_id    uuid        NOT NULL REFERENCES media_assets (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  CONSTRAINT stories_media_id_key UNIQUE (media_id),
  CONSTRAINT stories_expires_at_check CHECK (expires_at > created_at)
);

CREATE INDEX stories_author_active_idx ON stories (author_id, expires_at);
CREATE INDEX stories_expires_at_idx ON stories (expires_at);

-- ---------------------------------------------------------------------------
-- story_views (ENT-StoryView)
-- ---------------------------------------------------------------------------
CREATE TABLE story_views (
  story_id   uuid        NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
  viewer_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT story_views_pkey PRIMARY KEY (story_id, viewer_id)
);

CREATE INDEX story_views_story_idx ON story_views (story_id, viewed_at DESC);

-- ---------------------------------------------------------------------------
-- notifications (ENT-Notification)
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id            uuid        PRIMARY KEY,
  recipient_id  uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  actor_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type          text        NOT NULL,
  post_id       uuid        NULL REFERENCES posts (id) ON DELETE CASCADE,
  comment_id    uuid        NULL REFERENCES comments (id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz NULL,
  CONSTRAINT notifications_actor_check CHECK (actor_id <> recipient_id),
  CONSTRAINT notifications_type_check CHECK (type IN ('like', 'comment', 'follow')),
  CONSTRAINT notifications_type_refs_check CHECK (
       (type = 'follow'  AND post_id IS NULL     AND comment_id IS NULL)
    OR (type = 'like'    AND post_id IS NOT NULL AND comment_id IS NULL)
    OR (type = 'comment' AND post_id IS NOT NULL AND comment_id IS NOT NULL)
  )
);

CREATE INDEX notifications_recipient_idx ON notifications (recipient_id, created_at DESC, id DESC);
CREATE INDEX notifications_unread_idx ON notifications (recipient_id) WHERE read_at IS NULL;
CREATE UNIQUE INDEX notifications_like_uq ON notifications (recipient_id, actor_id, post_id) WHERE type = 'like';
CREATE UNIQUE INDEX notifications_follow_uq ON notifications (recipient_id, actor_id) WHERE type = 'follow';
CREATE INDEX notifications_actor_id_idx ON notifications (actor_id);
