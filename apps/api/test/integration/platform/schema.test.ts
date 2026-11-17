import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeTestPool, getTestPool, resetDb } from "../../helpers/index.js";

/**
 * F-DB-01: every table/column/constraint/index from persistence/01-schema.md and
 * persistence/02-migrations-and-indexes.md exists after `0001_init.sql`.
 */

type Col = [name: string, udt: string, nullable: boolean];
const ts = "timestamptz";

const TABLES: Record<string, Col[]> = {
  users: [
    ["id", "uuid", false],
    ["username", "text", false],
    ["email", "text", false],
    ["password_hash", "text", false],
    ["full_name", "text", false],
    ["bio", "text", false],
    ["avatar_media_id", "uuid", true],
    ["posts_count", "int4", false],
    ["followers_count", "int4", false],
    ["following_count", "int4", false],
    ["created_at", ts, false],
    ["updated_at", ts, false],
  ],
  sessions: [
    ["id", "uuid", false],
    ["user_id", "uuid", false],
    ["token_hash", "bytea", false],
    ["user_agent", "text", false],
    ["created_at", ts, false],
    ["expires_at", ts, false],
    ["revoked_at", ts, true],
  ],
  media_assets: [
    ["id", "uuid", false],
    ["owner_id", "uuid", false],
    ["purpose", "text", false],
    ["kind", "text", false],
    ["mime_type", "text", false],
    ["storage_key", "text", false],
    ["byte_size", "int8", false],
    ["width", "int4", true],
    ["height", "int4", true],
    ["duration_ms", "int4", true],
    ["status", "text", false],
    ["created_at", ts, false],
  ],
  posts: [
    ["id", "uuid", false],
    ["author_id", "uuid", false],
    ["caption", "text", false],
    ["like_count", "int4", false],
    ["comment_count", "int4", false],
    ["created_at", ts, false],
    ["updated_at", ts, false],
    ["deleted_at", ts, true],
  ],
  post_media: [
    ["post_id", "uuid", false],
    ["media_id", "uuid", false],
    ["position", "int2", false],
  ],
  post_hashtags: [
    ["post_id", "uuid", false],
    ["tag", "text", false],
    ["position", "int2", false],
  ],
  comments: [
    ["id", "uuid", false],
    ["post_id", "uuid", false],
    ["author_id", "uuid", false],
    ["text", "text", false],
    ["created_at", ts, false],
    ["deleted_at", ts, true],
  ],
  post_likes: [
    ["post_id", "uuid", false],
    ["user_id", "uuid", false],
    ["created_at", ts, false],
  ],
  follows: [
    ["follower_id", "uuid", false],
    ["followee_id", "uuid", false],
    ["created_at", ts, false],
  ],
  stories: [
    ["id", "uuid", false],
    ["author_id", "uuid", false],
    ["media_id", "uuid", false],
    ["created_at", ts, false],
    ["expires_at", ts, false],
  ],
  story_views: [
    ["story_id", "uuid", false],
    ["viewer_id", "uuid", false],
    ["viewed_at", ts, false],
  ],
  notifications: [
    ["id", "uuid", false],
    ["recipient_id", "uuid", false],
    ["actor_id", "uuid", false],
    ["type", "text", false],
    ["post_id", "uuid", true],
    ["comment_id", "uuid", true],
    ["created_at", ts, false],
    ["read_at", ts, true],
  ],
  schema_migrations: [
    ["version", "int4", false],
    ["name", "text", false],
    ["checksum", "text", false],
    ["applied_at", ts, false],
  ],
};

const PRIMARY_KEYS: Record<string, string[]> = {
  users: ["id"],
  sessions: ["id"],
  media_assets: ["id"],
  posts: ["id"],
  post_media: ["post_id", "position"],
  post_hashtags: ["post_id", "tag"],
  comments: ["id"],
  post_likes: ["post_id", "user_id"],
  follows: ["follower_id", "followee_id"],
  stories: ["id"],
  story_views: ["story_id", "viewer_id"],
  notifications: ["id"],
  schema_migrations: ["version"],
};

/** [table, column, referenced table, ON DELETE] */
const FOREIGN_KEYS: [string, string, string, string][] = [
  ["users", "avatar_media_id", "media_assets", "SET NULL"],
  ["sessions", "user_id", "users", "CASCADE"],
  ["media_assets", "owner_id", "users", "CASCADE"],
  ["posts", "author_id", "users", "CASCADE"],
  ["post_media", "post_id", "posts", "CASCADE"],
  ["post_media", "media_id", "media_assets", "RESTRICT"],
  ["post_hashtags", "post_id", "posts", "CASCADE"],
  ["comments", "post_id", "posts", "CASCADE"],
  ["comments", "author_id", "users", "CASCADE"],
  ["post_likes", "post_id", "posts", "CASCADE"],
  ["post_likes", "user_id", "users", "CASCADE"],
  ["follows", "follower_id", "users", "CASCADE"],
  ["follows", "followee_id", "users", "CASCADE"],
  ["stories", "author_id", "users", "CASCADE"],
  ["stories", "media_id", "media_assets", "CASCADE"],
  ["story_views", "story_id", "stories", "CASCADE"],
  ["story_views", "viewer_id", "users", "CASCADE"],
  ["notifications", "recipient_id", "users", "CASCADE"],
  ["notifications", "actor_id", "users", "CASCADE"],
  ["notifications", "post_id", "posts", "CASCADE"],
  ["notifications", "comment_id", "comments", "CASCADE"],
];

/** Unique single-column constraints: [table, column]. */
const UNIQUES: [string, string][] = [
  ["users", "username"],
  ["users", "email"],
  ["sessions", "token_hash"],
  ["media_assets", "storage_key"],
  ["post_media", "media_id"],
  ["stories", "media_id"],
];

/** Index catalog (persistence/02). */
const INDEXES = [
  "users_username_key",
  "users_email_key",
  "users_username_prefix_idx",
  "users_username_trgm_idx",
  "users_full_name_trgm_idx",
  "sessions_token_hash_key",
  "sessions_user_id_idx",
  "media_assets_owner_id_idx",
  "media_assets_unattached_idx",
  "posts_author_feed_idx",
  "posts_recent_idx",
  "post_media_media_id_key",
  "post_hashtags_tag_idx",
  "comments_post_idx",
  "comments_author_id_idx",
  "post_likes_user_id_idx",
  "post_likes_post_recent_idx",
  "follows_followee_idx",
  "follows_follower_idx",
  "stories_author_active_idx",
  "stories_expires_at_idx",
  "story_views_story_idx",
  "notifications_recipient_idx",
  "notifications_unread_idx",
  "notifications_like_uq",
  "notifications_follow_uq",
  "notifications_actor_id_idx",
];

/** Minimum number of CHECK constraints per table (from the spec's constraint column). */
const MIN_CHECKS: Record<string, number> = {
  users: 6,
  sessions: 3,
  media_assets: 9,
  posts: 3,
  post_media: 1,
  post_hashtags: 1,
  comments: 1,
  follows: 1,
  stories: 1,
  notifications: 3,
};

const DELETE_RULE: Record<string, string> = {
  a: "NO ACTION",
  r: "RESTRICT",
  c: "CASCADE",
  n: "SET NULL",
  d: "SET DEFAULT",
};

describe("schema v1 (F-DB-01)", () => {
  const pool = getTestPool();

  beforeAll(async () => {
    await resetDb(pool);
  });
  afterAll(async () => {
    await closeTestPool();
  });

  it("has exactly the expected tables", async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual(Object.keys(TABLES).sort());
  });

  it.each(Object.entries(TABLES))("%s has the spec columns, types and nullability", async (table, cols) => {
    const { rows } = await pool.query<{ column_name: string; udt_name: string; is_nullable: string }>(
      `SELECT column_name, udt_name, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [table],
    );
    expect(rows.map((r) => [r.column_name, r.udt_name, r.is_nullable === "YES"])).toEqual(cols);
  });

  it("primary keys match", async () => {
    const { rows } = await pool.query<{ table: string; cols: string[] }>(
      `SELECT c.conrelid::regclass::text AS table,
              array_agg(a.attname::text ORDER BY array_position(c.conkey, a.attnum)) AS cols
         FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.contype = 'p' AND c.connamespace = 'public'::regnamespace
        GROUP BY c.conrelid`,
    );
    expect(Object.fromEntries(rows.map((r) => [r.table, r.cols]))).toEqual(PRIMARY_KEYS);
  });

  it("foreign keys reference the right tables with the spec ON DELETE rule", async () => {
    const { rows } = await pool.query<{ table: string; col: string; ref: string; rule: string }>(
      `SELECT c.conrelid::regclass::text AS table, a.attname AS col, c.confrelid::regclass::text AS ref,
              c.confdeltype AS rule
         FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`,
    );
    const actual = rows.map((r) => [r.table, r.col, r.ref, DELETE_RULE[r.rule]]).sort();
    expect(actual).toEqual([...FOREIGN_KEYS].sort());
  });

  it("unique constraints exist", async () => {
    const { rows } = await pool.query<{ table: string; col: string }>(
      `SELECT c.conrelid::regclass::text AS table, a.attname AS col
         FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'u' AND c.connamespace = 'public'::regnamespace AND array_length(c.conkey, 1) = 1`,
    );
    expect(rows.map((r) => [r.table, r.col]).sort()).toEqual([...UNIQUES].sort());
  });

  it("CHECK constraints exist on every constrained table", async () => {
    const { rows } = await pool.query<{ table: string; n: number }>(
      `SELECT conrelid::regclass::text AS table, count(*)::int AS n FROM pg_constraint
        WHERE contype = 'c' AND connamespace = 'public'::regnamespace GROUP BY conrelid`,
    );
    const counts = Object.fromEntries(rows.map((r) => [r.table, r.n]));
    for (const [table, min] of Object.entries(MIN_CHECKS)) {
      expect(counts[table] ?? 0, table).toBeGreaterThanOrEqual(min);
    }
  });

  it("every catalog index exists (persistence/02)", async () => {
    const { rows } = await pool.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
    );
    const names = new Set(rows.map((r) => r.indexname));
    for (const idx of INDEXES) expect(names.has(idx), idx).toBe(true);
  });

  it("pg_trgm is installed", async () => {
    const { rows } = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'");
    expect(rows).toHaveLength(1);
  });
});
