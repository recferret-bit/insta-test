-- 0001_init.sql — schema v1 (F-DB-01, F-DB-03)
-- Source of truth: docs/specs/persistence/01-schema.md and 02-migrations-and-indexes.md.
-- Forward-only and immutable once applied (checksum enforced). The runner wraps this file in
-- BEGIN … COMMIT, so it contains no transaction statements and no CREATE INDEX CONCURRENTLY.
-- Constraint names that repositories translate to domain errors are spelled out explicitly.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- users (avatar FK added after media_assets exists)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id               uuid        NOT NULL,
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
  CONSTRAINT users_pkey PRIMARY KEY (id),
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

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
  id          uuid        NOT NULL,
  user_id     uuid        NOT NULL,
  token_hash  bytea       NOT NULL,
  user_agent  text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz NULL,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT sessions_token_hash_key UNIQUE (token_hash),
  CONSTRAINT sessions_token_hash_check CHECK (octet_length(token_hash) = 32),
  CONSTRAINT sessions_user_agent_check CHECK (char_length(user_agent) <= 255),
  CONSTRAINT sessions_expires_at_check CHECK (expires_at > created_at)
);

-- ---------------------------------------------------------------------------
-- media_assets
-- ---------------------------------------------------------------------------
CREATE TABLE media_assets (
  id           uuid        NOT NULL,
  owner_id     uuid        NOT NULL,
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
  CONSTRAINT media_assets_pkey PRIMARY KEY (id),
  CONSTRAINT media_assets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
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

ALTER TABLE users
  ADD CONSTRAINT users_avatar_media_id_fkey
  FOREIGN KEY (avatar_media_id) REFERENCES media_assets (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- posts, post_media, post_hashtags
-- ---------------------------------------------------------------------------
CREATE TABLE posts (
  id             uuid        NOT NULL,
  author_id      uuid        NOT NULL,
  caption        text        NOT NULL DEFAULT '',
  like_count     integer     NOT NULL DEFAULT 0,
  comment_count  integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz NULL,
  CONSTRAINT posts_pkey PRIMARY KEY (id),
  CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT posts_caption_check CHECK (char_length(caption) <= 2200),
  CONSTRAINT posts_like_count_check CHECK (like_count >= 0),
  CONSTRAINT posts_comment_count_check CHECK (comment_count >= 0)
);

CREATE TABLE post_media (
  post_id   uuid     NOT NULL,
  media_id  uuid     NOT NULL,
  position  smallint NOT NULL,
  CONSTRAINT post_media_pkey PRIMARY KEY (post_id, position),
  CONSTRAINT post_media_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT post_media_media_id_fkey FOREIGN KEY (media_id) REFERENCES media_assets (id) ON DELETE RESTRICT,
  CONSTRAINT post_media_media_id_key UNIQUE (media_id),
  CONSTRAINT post_media_position_check CHECK (position BETWEEN 0 AND 9)
);

CREATE TABLE post_hashtags (
  post_id   uuid     NOT NULL,
  tag       text     NOT NULL,
  position  smallint NOT NULL,
  CONSTRAINT post_hashtags_pkey PRIMARY KEY (post_id, tag),
  CONSTRAINT post_hashtags_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT post_hashtags_tag_check CHECK (tag = lower(tag) AND char_length(tag) BETWEEN 1 AND 64)
);

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
CREATE TABLE comments (
  id          uuid        NOT NULL,
  post_id     uuid        NOT NULL,
  author_id   uuid        NOT NULL,
  text        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL,
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT comments_text_check CHECK (char_length(text) BETWEEN 1 AND 500)
);

-- ---------------------------------------------------------------------------
-- post_likes
-- ---------------------------------------------------------------------------
CREATE TABLE post_likes (
  post_id     uuid        NOT NULL,
  user_id     uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id),
  CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------
CREATE TABLE follows (
  follower_id  uuid        NOT NULL,
  followee_id  uuid        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follows_pkey PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT follows_followee_id_fkey FOREIGN KEY (followee_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT follows_check CHECK (follower_id <> followee_id)
);

-- ---------------------------------------------------------------------------
-- stories, story_views
-- ---------------------------------------------------------------------------
CREATE TABLE stories (
  id          uuid        NOT NULL,
  author_id   uuid        NOT NULL,
  media_id    uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  CONSTRAINT stories_pkey PRIMARY KEY (id),
  CONSTRAINT stories_author_id_fkey FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT stories_media_id_fkey FOREIGN KEY (media_id) REFERENCES media_assets (id) ON DELETE CASCADE,
  CONSTRAINT stories_media_id_key UNIQUE (media_id),
  CONSTRAINT stories_expires_at_check CHECK (expires_at > created_at)
);

CREATE TABLE story_views (
  story_id   uuid        NOT NULL,
  viewer_id  uuid        NOT NULL,
  viewed_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT story_views_pkey PRIMARY KEY (story_id, viewer_id),
  CONSTRAINT story_views_story_id_fkey FOREIGN KEY (story_id) REFERENCES stories (id) ON DELETE CASCADE,
  CONSTRAINT story_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id            uuid        NOT NULL,
  recipient_id  uuid        NOT NULL,
  actor_id      uuid        NOT NULL,
  type          text        NOT NULL,
  post_id       uuid        NULL,
  comment_id    uuid        NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz NULL,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT notifications_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE,
  CONSTRAINT notifications_actor_check CHECK (actor_id <> recipient_id),
  CONSTRAINT notifications_type_check CHECK (type IN ('like', 'comment', 'follow')),
  CONSTRAINT notifications_target_check CHECK (
    (type = 'follow' AND post_id IS NULL AND comment_id IS NULL)
    OR (type = 'like' AND post_id IS NOT NULL AND comment_id IS NULL)
    OR (type = 'comment' AND post_id IS NOT NULL AND comment_id IS NOT NULL)
  )
);

-- ---------------------------------------------------------------------------
-- Index catalog (persistence/02-migrations-and-indexes.md#index-catalog).
-- users_username_key, users_email_key, sessions_token_hash_key and post_media_media_id_key
-- are created by the UNIQUE constraints above.
-- ---------------------------------------------------------------------------
CREATE INDEX users_username_prefix_idx ON users (username text_pattern_ops);
CREATE INDEX users_username_trgm_idx ON users USING gin (username gin_trgm_ops);
CREATE INDEX users_full_name_trgm_idx ON users USING gin (lower(full_name) gin_trgm_ops);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE INDEX media_assets_owner_id_idx ON media_assets (owner_id);
CREATE INDEX media_assets_unattached_idx ON media_assets (created_at) WHERE status = 'uploaded';

CREATE INDEX posts_author_feed_idx ON posts (author_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX posts_recent_idx ON posts (created_at DESC, id DESC) WHERE deleted_at IS NULL;

CREATE INDEX post_hashtags_tag_idx ON post_hashtags (tag text_pattern_ops, post_id);

CREATE INDEX comments_post_idx ON comments (post_id, created_at, id) WHERE deleted_at IS NULL;
CREATE INDEX comments_author_id_idx ON comments (author_id);

CREATE INDEX post_likes_user_id_idx ON post_likes (user_id);
CREATE INDEX post_likes_post_recent_idx ON post_likes (post_id, created_at DESC);

CREATE INDEX follows_followee_idx ON follows (followee_id, created_at DESC);
CREATE INDEX follows_follower_idx ON follows (follower_id, created_at DESC);

CREATE INDEX stories_author_active_idx ON stories (author_id, expires_at);
CREATE INDEX stories_expires_at_idx ON stories (expires_at);

CREATE INDEX story_views_story_idx ON story_views (story_id, viewed_at DESC);

CREATE INDEX notifications_recipient_idx ON notifications (recipient_id, created_at DESC, id DESC);
CREATE INDEX notifications_unread_idx ON notifications (recipient_id) WHERE read_at IS NULL;
CREATE UNIQUE INDEX notifications_like_uq ON notifications (recipient_id, actor_id, post_id) WHERE type = 'like';
CREATE UNIQUE INDEX notifications_follow_uq ON notifications (recipient_id, actor_id) WHERE type = 'follow';
CREATE INDEX notifications_actor_id_idx ON notifications (actor_id);
