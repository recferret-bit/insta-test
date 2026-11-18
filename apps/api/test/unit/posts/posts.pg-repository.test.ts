import type pg from "pg";
import { describe, expect, it } from "vitest";

import { toTx, type Queryable } from "../../../src/data/db/tx.js";
import { hydratePostViews, PgPostRepository } from "../../../src/data/repositories/posts.pg-repository.js";
import type { PostViewRow } from "../../../src/data/rows/posts.row.js";
import { Post } from "../../../src/domain/posts/post.entity.js";
import type { MediaId, PostId, UserId } from "../../../src/domain/shared/ids.js";

const AUTHOR = "0190a000-0000-7000-8000-00000000a11c" as UserId;
const post = Post.create({
  id: "0190a000-0000-7000-8000-000000000001" as PostId,
  authorId: AUTHOR,
  caption: "hello #x",
  mediaIds: ["0190a000-0000-7000-9000-000000000001" as MediaId],
  now: new Date("2026-11-17T10:00:00.000Z"),
});

/** Records every query; fails the first one matching `failOn` with `err`. */
function recordingClient(opts: { failOn?: RegExp; err?: unknown; rows?: (sql: string) => unknown[] } = {}) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (opts.failOn?.test(sql)) throw opts.err;
      return { rows: opts.rows?.(sql) ?? [] };
    },
  };
  return { client: client as unknown as Queryable, queries };
}

const unusedPool = {} as pg.Pool;

describe("PgPostRepository error translation", () => {
  it.each([
    [{ code: "23505", constraint: "post_media_media_id_key" }, "MEDIA_INVALID"],
    [{ code: "23503", constraint: "posts_author_id_fkey" }, "NOT_FOUND"],
  ])("insert: %o → %s", async (err, code) => {
    const { client } = recordingClient({ failOn: /INSERT INTO post_media/, err });
    const repo = new PgPostRepository(unusedPool);
    await expect(repo.insert(post, toTx(client as unknown as pg.PoolClient))).rejects.toMatchObject({ code });
  });

  it("insert: other pg errors pass through unchanged", async () => {
    const raw = { code: "23514", constraint: "posts_caption_check" };
    const { client } = recordingClient({ failOn: /INSERT INTO posts/, err: raw });
    const repo = new PgPostRepository(unusedPool);
    await expect(repo.insert(post, toTx(client as unknown as pg.PoolClient))).rejects.toBe(raw);
  });

  it("insert: writes posts, post_media and post_hashtags on the tx client; no hashtag insert when none", async () => {
    const { client, queries } = recordingClient();
    const repo = new PgPostRepository(unusedPool);
    await repo.insert(post, toTx(client as unknown as pg.PoolClient));
    expect(queries.map((q) => q.sql.match(/INSERT INTO (\w+)/)?.[1])).toEqual([
      "posts",
      "post_media",
      "post_hashtags",
    ]);
    expect(queries[2]!.params).toEqual([post.id, ["x"], [0]]);

    const bare = Post.editCaption(post, "no tags", post.createdAt);
    const second = recordingClient();
    await repo.insert(bare, toTx(second.client as unknown as pg.PoolClient));
    expect(second.queries).toHaveLength(2);
  });

  it("adjustCounters → NOT_FOUND when no row is updated", async () => {
    const { client } = recordingClient();
    const repo = new PgPostRepository(unusedPool);
    await expect(
      repo.adjustCounters(post.id, { likes: 1 }, toTx(client as unknown as pg.PoolClient)),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("findLive locks the row only inside a transaction", async () => {
    const { client, queries } = recordingClient();
    const repo = new PgPostRepository(client as unknown as pg.Pool);
    await repo.findLive(post.id);
    await repo.findLive(post.id, toTx(client as unknown as pg.PoolClient));
    expect(queries[0]!.sql).not.toMatch(/FOR NO KEY UPDATE/);
    expect(queries[1]!.sql).toMatch(/FOR NO KEY UPDATE/);
  });
});

describe("hydratePostViews", () => {
  it("returns [] without querying for an empty page", async () => {
    const { client, queries } = recordingClient();
    expect(await hydratePostViews(client, [], AUTHOR)).toEqual([]);
    expect(queries).toHaveLength(0);
  });

  it("uses a constant number of batched queries and skips the like probe for anonymous viewers", async () => {
    const row = (id: string): PostViewRow => ({
      id,
      author_id: AUTHOR,
      caption: "",
      like_count: 0,
      comment_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      author_username: "alice",
      author_full_name: "",
      author_avatar_storage_key: null,
      author_is_following: null,
    });
    const rows = [row("0190a000-0000-7000-8000-000000000001"), row("0190a000-0000-7000-8000-000000000002")];
    const signedIn = recordingClient({
      rows: (sql) => (/post_likes/.test(sql) ? [{ post_id: rows[1]!.id }] : []),
    });
    const views = await hydratePostViews(signedIn.client, rows, AUTHOR);
    expect(signedIn.queries).toHaveLength(3);
    expect(signedIn.queries.every((q) => /= ANY\(\$1::uuid\[\]\)/.test(q.sql))).toBe(true);
    expect(views.map((v) => [v.id, v.viewerHasLiked])).toEqual([
      [rows[0]!.id, false],
      [rows[1]!.id, true],
    ]);

    const anonymous = recordingClient();
    await hydratePostViews(anonymous.client, rows, null);
    expect(anonymous.queries).toHaveLength(2);
  });
});
