import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TABLE_COLUMNS } from "../rows/index.ts";
import { DOMAIN_LIMITS } from "../domain/shared/limits.ts";

// Static checks of the SQL text (no Postgres needed). The information_schema check against a live DB
// belongs to the API integration suite (F-DB-01).
const sqlPath = fileURLToPath(new URL("../../../../db/migrations/0001_init.sql", import.meta.url));
const sql = readFileSync(sqlPath, "utf8").replace(/--[^\n]*/g, "");

function tableBody(table: string): string {
  const start = sql.indexOf(`CREATE TABLE ${table} (`);
  assert.ok(start >= 0, `missing CREATE TABLE ${table}`);
  const end = sql.indexOf("\n);", start);
  return sql.slice(start, end);
}

function columnsOf(table: string): string[] {
  return tableBody(table)
    .split("\n")
    .slice(1)
    .map((l) => l.trim())
    // Column definition lines only: `<name> <type> …`; skips CONSTRAINT / CHECK continuation lines.
    .filter((l) => /^[a-z_]+\s+(uuid|text|integer|bigint|bytea|smallint|timestamptz)\b/.test(l))
    .map((l) => l.split(/\s+/)[0]!);
}

test("every table's columns match the row type column list, in order", () => {
  for (const [table, cols] of Object.entries(TABLE_COLUMNS)) {
    assert.deepEqual(columnsOf(table), [...cols], `columns of ${table}`);
  }
});

test("tables are created in the FK order from persistence/02", () => {
  const order = Object.keys(TABLE_COLUMNS);
  const positions = order.map((t) => sql.indexOf(`CREATE TABLE ${t} (`));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  const alter = sql.indexOf("ADD CONSTRAINT users_avatar_media_id_fkey");
  assert.ok(alter > sql.indexOf("CREATE TABLE media_assets (") && alter < sql.indexOf("CREATE TABLE posts ("));
});

test("no extra tables beyond the spec (schema_migrations is owned by the runner)", () => {
  const created = [...sql.matchAll(/CREATE TABLE (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(created, Object.keys(TABLE_COLUMNS));
});

test("every FK has an explicit ON DELETE rule", () => {
  const refs = [...sql.matchAll(/REFERENCES [^\n,]+/g)].map((m) => m[0]);
  assert.ok(refs.length >= 20);
  for (const r of refs) assert.match(r, /ON DELETE (CASCADE|SET NULL|RESTRICT)/, r);
});

test("index catalog from persistence/02 is complete", () => {
  const indexes = [
    "users_username_key", "users_email_key", "users_username_prefix_idx", "users_username_trgm_idx",
    "users_full_name_trgm_idx", "sessions_token_hash_key", "sessions_user_id_idx", "media_assets_owner_id_idx",
    "media_assets_unattached_idx", "posts_author_feed_idx", "posts_recent_idx", "post_media_media_id_key",
    "post_hashtags_tag_idx", "comments_post_idx", "comments_author_id_idx", "post_likes_user_id_idx",
    "post_likes_post_recent_idx", "follows_followee_idx", "follows_follower_idx", "stories_author_active_idx",
    "stories_expires_at_idx", "story_views_story_idx", "notifications_recipient_idx", "notifications_unread_idx",
    "notifications_like_uq", "notifications_follow_uq", "notifications_actor_id_idx",
  ];
  for (const name of indexes) assert.match(sql, new RegExp(`\\b${name}\\b`), name);
});

test("constraint names relied on by repository error translation exist", () => {
  for (const name of ["users_username_key", "users_email_key", "post_media_media_id_key", "stories_media_id_key", "follows_check"]) {
    assert.match(sql, new RegExp(`CONSTRAINT ${name}\\b`), name);
  }
});

test("DB CHECK limits equal domain limits", () => {
  const L = DOMAIN_LIMITS;
  assert.ok(sql.includes(`^[a-z0-9._]{${L.usernameMin},${L.usernameMax}}$`));
  assert.ok(sql.includes(`char_length(email) <= ${L.emailMax}`));
  assert.ok(sql.includes(`char_length(full_name) <= ${L.fullNameMax}`));
  assert.ok(sql.includes(`char_length(bio) <= ${L.bioMax}`));
  assert.ok(sql.includes(`char_length(caption) <= ${L.captionMax}`));
  assert.ok(sql.includes(`char_length(text) BETWEEN 1 AND ${L.commentMax}`));
  assert.ok(sql.includes(`char_length(tag) BETWEEN 1 AND ${L.hashtagMax}`));
  assert.ok(sql.includes(`char_length(user_agent) <= ${L.userAgentMax}`));
  assert.ok(sql.includes(`width BETWEEN 1 AND ${L.mediaDimensionMax}`));
  assert.ok(sql.includes(`height BETWEEN 1 AND ${L.mediaDimensionMax}`));
  assert.ok(sql.includes(`duration_ms BETWEEN 1 AND ${L.videoDurationMsMax}`));
  assert.ok(sql.includes(`position BETWEEN 0 AND ${L.postMediaMax - 1}`));
});

test("no transaction control or CONCURRENTLY in the migration (runner wraps it in a tx)", () => {
  assert.doesNotMatch(sql, /\b(BEGIN|COMMIT|ROLLBACK)\b/);
  assert.doesNotMatch(sql, /CONCURRENTLY/);
});
