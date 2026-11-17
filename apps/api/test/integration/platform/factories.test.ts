import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashToken } from "../../../src/data/crypto/token-generator.js";
import {
  closeTestPool,
  createAuthedUser,
  getTestPool,
  insertComment,
  insertFollow,
  insertLike,
  insertMedia,
  insertNotification,
  insertPost,
  insertPostHashtag,
  insertPostMedia,
  insertPostWithMedia,
  insertSession,
  insertStory,
  insertStoryView,
  insertUser,
  resetDb,
  testPasswordHasher,
  TEST_PASSWORD,
  truncateAll,
} from "../../helpers/index.js";
import type { PasswordHash } from "../../../src/domain/identity/user.entity.js";

/** The SQL-level factories satisfy every constraint of schema v1. */
describe("test factories", () => {
  const pool = getTestPool();

  beforeAll(async () => {
    await resetDb(pool);
  });
  afterAll(async () => {
    await closeTestPool();
  });

  it("insert one valid row into every table", async () => {
    const alice = await insertUser(pool, { username: "alice" });
    const bob = await insertUser(pool);
    expect(alice).toMatchObject({ username: "alice", email: "alice@example.test", posts_count: 0 });
    expect(await testPasswordHasher.verify(alice.password_hash as PasswordHash, TEST_PASSWORD)).toBe(true);

    const session = await insertSession(pool, { user_id: alice.id, token_hash: hashToken("t") });
    expect(session.expires_at.getTime()).toBeGreaterThan(session.created_at.getTime());

    const media = await insertMedia(pool, { owner_id: alice.id });
    expect(media).toMatchObject({
      kind: "image",
      mime_type: "image/jpeg",
      status: "uploaded",
      byte_size: "2048",
    });
    expect(media.storage_key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.jpg$/);
    const video = await insertMedia(pool, { owner_id: alice.id, kind: "video" });
    expect(video).toMatchObject({ mime_type: "video/mp4", duration_ms: 5000 });

    const post = await insertPost(pool, { author_id: alice.id, caption: "hi #sun" });
    await insertPostMedia(pool, { post_id: post.id, media_id: media.id, position: 0 });
    await insertPostHashtag(pool, { post_id: post.id, tag: "sun", position: 0 });
    const comment = await insertComment(pool, { post_id: post.id, author_id: bob.id });
    await insertLike(pool, { post_id: post.id, user_id: bob.id });
    await insertFollow(pool, { follower_id: bob.id, followee_id: alice.id });
    const story = await insertStory(pool, { author_id: alice.id });
    expect(story.expires_at.getTime() - story.created_at.getTime()).toBe(24 * 60 * 60 * 1000);
    await insertStoryView(pool, { story_id: story.id, viewer_id: bob.id });
    await insertNotification(pool, { recipient_id: alice.id, actor_id: bob.id });
    await insertNotification(pool, {
      recipient_id: alice.id,
      actor_id: bob.id,
      type: "like",
      post_id: post.id,
    });
    await insertNotification(pool, {
      recipient_id: alice.id,
      actor_id: bob.id,
      type: "comment",
      post_id: post.id,
      comment_id: comment.id,
    });

    const { rows } = await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM notifications");
    expect(rows[0]?.n).toBe(3);
  });

  it("insertPostWithMedia attaches media in order, adds hashtags and bumps posts_count", async () => {
    const author = await insertUser(pool);
    const { post, media, hashtags } = await insertPostWithMedia(pool, {
      author_id: author.id,
      mediaCount: 3,
      hashtags: ["a", "b"],
    });
    expect(media).toHaveLength(3);
    expect(hashtags.map((h) => h.tag)).toEqual(["a", "b"]);
    const { rows } = await pool.query(
      "SELECT media_id FROM post_media WHERE post_id = $1 ORDER BY position",
      [post.id],
    );
    expect(rows.map((r) => r.media_id)).toEqual(media.map((m) => m.id));
    const user = await pool.query("SELECT posts_count FROM users WHERE id = $1", [author.id]);
    expect(user.rows[0]?.posts_count).toBe(1);
  });

  it("createAuthedUser returns a raw token whose sha256 is stored", async () => {
    const authed = await createAuthedUser(pool);
    expect(authed.headers.authorization).toBe(`Bearer ${authed.token}`);
    expect(authed.session.token_hash).toEqual(hashToken(authed.token));
  });

  it("truncateAll empties every table", async () => {
    await truncateAll(pool);
    const { rows } = await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM users");
    expect(rows[0]?.n).toBe(0);
  });
});
