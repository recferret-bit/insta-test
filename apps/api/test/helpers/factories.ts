import { v7 as uuidv7 } from "uuid";

import { Argon2PasswordHasher } from "../../src/data/crypto/argon2-password-hasher.js";
import type { Queryable } from "../../src/data/db/tx.js";
import type { CommentRow } from "../../src/data/rows/comments.row.js";
import type { FollowRow } from "../../src/data/rows/follows.row.js";
import type { PostLikeRow } from "../../src/data/rows/likes.row.js";
import type { MediaAssetRow } from "../../src/data/rows/media.row.js";
import type { NotificationRow } from "../../src/data/rows/notifications.row.js";
import type { PostHashtagRow, PostMediaRow, PostRow } from "../../src/data/rows/posts.row.js";
import type { SessionRow } from "../../src/data/rows/sessions.row.js";
import type { StoryRow, StoryViewRow } from "../../src/data/rows/stories.row.js";
import type { UserRow } from "../../src/data/rows/users.row.js";

/**
 * SQL-level factories, one per table. They bypass services on purpose (arrange state directly)
 * and do NOT maintain denormalized counters — pass `posts_count`, `like_count`, … explicitly when a
 * test depends on them. Every factory returns the inserted row (`RETURNING *`).
 */

/** Plaintext password of every factory user unless `password` is given. */
export const TEST_PASSWORD = "correct-horse-battery";

/** Cheap argon2id parameters so tests stay fast; production uses the defaults. */
export const testPasswordHasher = new Argon2PasswordHasher({ memoryCost: 1024, timeCost: 1, parallelism: 1 });

const hashCache = new Map<string, Promise<string>>();
function hashPassword(pw: string): Promise<string> {
  let cached = hashCache.get(pw);
  if (!cached) {
    cached = testPasswordHasher.hash(pw);
    hashCache.set(pw, cached);
  }
  return cached;
}

let sequence = 0;
function nextSeq(): number {
  sequence += 1;
  return sequence;
}

async function insertRow<R>(db: Queryable, table: string, values: Record<string, unknown>): Promise<R> {
  const entries = Object.entries(values).filter(([, v]) => v !== undefined);
  const columns = entries.map(([k]) => k).join(", ");
  const params = entries.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await db.query(
    `INSERT INTO ${table} (${columns}) VALUES (${params}) RETURNING *`,
    entries.map(([, v]) => v),
  );
  return rows[0] as R;
}

export type InsertUserInput = Partial<UserRow> & { password?: string };

export async function insertUser(db: Queryable, input: InsertUserInput = {}): Promise<UserRow> {
  const { password, ...row } = input;
  const n = nextSeq();
  const username = row.username ?? `user_${n}_${Math.random().toString(36).slice(2, 8)}`;
  return insertRow<UserRow>(db, "users", {
    id: uuidv7(),
    username,
    email: `${username}@example.test`,
    password_hash: row.password_hash ?? (await hashPassword(password ?? TEST_PASSWORD)),
    full_name: `User ${n}`,
    ...row,
  });
}

export type InsertSessionInput = Partial<SessionRow> & Pick<SessionRow, "user_id" | "token_hash">;

export async function insertSession(db: Queryable, input: InsertSessionInput): Promise<SessionRow> {
  const createdAt = input.created_at ?? new Date();
  return insertRow<SessionRow>(db, "sessions", {
    id: uuidv7(),
    user_agent: "vitest",
    created_at: createdAt,
    expires_at: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
    ...input,
  });
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export type InsertMediaInput = Partial<MediaAssetRow> & Pick<MediaAssetRow, "owner_id">;

export async function insertMedia(db: Queryable, input: InsertMediaInput): Promise<MediaAssetRow> {
  const id = input.id ?? uuidv7();
  const kind = input.kind ?? (input.mime_type?.startsWith("video/") ? "video" : "image");
  const mime = input.mime_type ?? (kind === "video" ? "video/mp4" : "image/jpeg");
  return insertRow<MediaAssetRow>(db, "media_assets", {
    id,
    purpose: "post",
    kind,
    mime_type: mime,
    storage_key: `2026/11/${id}.${EXT[mime] ?? "bin"}`,
    byte_size: "2048",
    width: 1080,
    height: 1080,
    duration_ms: kind === "video" ? 5_000 : null,
    status: "uploaded",
    ...input,
  });
}

export type InsertPostInput = Partial<PostRow> & Pick<PostRow, "author_id">;

export async function insertPost(db: Queryable, input: InsertPostInput): Promise<PostRow> {
  return insertRow<PostRow>(db, "posts", { id: uuidv7(), caption: "", ...input });
}

export async function insertPostMedia(db: Queryable, input: PostMediaRow): Promise<PostMediaRow> {
  return insertRow<PostMediaRow>(db, "post_media", input);
}

export async function insertPostHashtag(db: Queryable, input: PostHashtagRow): Promise<PostHashtagRow> {
  return insertRow<PostHashtagRow>(db, "post_hashtags", input);
}

/**
 * Composite helper: a live post with `mediaCount` attached images and the given hashtags,
 * and `users.posts_count` incremented to keep the counter consistent.
 */
export async function insertPostWithMedia(
  db: Queryable,
  input: InsertPostInput & { mediaCount?: number; hashtags?: string[] },
): Promise<{ post: PostRow; media: MediaAssetRow[]; hashtags: PostHashtagRow[] }> {
  const { mediaCount = 1, hashtags = [], ...postInput } = input;
  const post = await insertPost(db, postInput);
  const media: MediaAssetRow[] = [];
  for (let position = 0; position < mediaCount; position += 1) {
    const asset = await insertMedia(db, { owner_id: post.author_id, status: "attached" });
    await insertPostMedia(db, { post_id: post.id, media_id: asset.id, position });
    media.push(asset);
  }
  const tags: PostHashtagRow[] = [];
  for (const [position, tag] of hashtags.entries()) {
    tags.push(await insertPostHashtag(db, { post_id: post.id, tag, position }));
  }
  await db.query("UPDATE users SET posts_count = posts_count + 1 WHERE id = $1", [post.author_id]);
  return { post, media, hashtags: tags };
}

export type InsertCommentInput = Partial<CommentRow> & Pick<CommentRow, "post_id" | "author_id">;

export async function insertComment(db: Queryable, input: InsertCommentInput): Promise<CommentRow> {
  return insertRow<CommentRow>(db, "comments", { id: uuidv7(), text: `comment ${nextSeq()}`, ...input });
}

export type InsertLikeInput = Partial<PostLikeRow> & Pick<PostLikeRow, "post_id" | "user_id">;

export async function insertLike(db: Queryable, input: InsertLikeInput): Promise<PostLikeRow> {
  return insertRow<PostLikeRow>(db, "post_likes", { ...input });
}

export type InsertFollowInput = Partial<FollowRow> & Pick<FollowRow, "follower_id" | "followee_id">;

export async function insertFollow(db: Queryable, input: InsertFollowInput): Promise<FollowRow> {
  return insertRow<FollowRow>(db, "follows", { ...input });
}

export type InsertStoryInput = Partial<StoryRow> & Pick<StoryRow, "author_id">;

/** Creates the backing `story` media (attached) unless `media_id` is given; expires 24 h after creation. */
export async function insertStory(db: Queryable, input: InsertStoryInput): Promise<StoryRow> {
  const createdAt = input.created_at ?? new Date();
  const mediaId =
    input.media_id ??
    (await insertMedia(db, { owner_id: input.author_id, purpose: "story", status: "attached" })).id;
  return insertRow<StoryRow>(db, "stories", {
    id: uuidv7(),
    media_id: mediaId,
    created_at: createdAt,
    expires_at: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
    ...input,
  });
}

export type InsertStoryViewInput = Partial<StoryViewRow> & Pick<StoryViewRow, "story_id" | "viewer_id">;

export async function insertStoryView(db: Queryable, input: InsertStoryViewInput): Promise<StoryViewRow> {
  return insertRow<StoryViewRow>(db, "story_views", { ...input });
}

export type InsertNotificationInput = Partial<NotificationRow> &
  Pick<NotificationRow, "recipient_id" | "actor_id">;

/** Defaults to a `follow` notification; pass `type` + `post_id` (+ `comment_id`) for the others. */
export async function insertNotification(
  db: Queryable,
  input: InsertNotificationInput,
): Promise<NotificationRow> {
  return insertRow<NotificationRow>(db, "notifications", { id: uuidv7(), type: "follow", ...input });
}
