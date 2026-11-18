import type pg from "pg";
import { describe, expect, it } from "vitest";

import { toTx } from "../../../src/data/db/tx.js";
import { PgCommentRepository } from "../../../src/data/repositories/comments.pg-repository.js";
import { PgLikeRepository } from "../../../src/data/repositories/likes.pg-repository.js";
import { Comment } from "../../../src/domain/posts/comment.entity.js";
import type { CommentId, PostId, UserId } from "../../../src/domain/shared/ids.js";

const POST = "0190a000-0000-7000-a000-000000000001" as PostId;
const USER = "0190a000-0000-7000-8000-000000000b0b" as UserId;
const at = new Date("2026-11-17T10:00:00.000Z");

/** Records `(sql, params)`; fails queries matching `failOn` with `err`; serves `rows`/`rowCount`. */
function recording(opts: { failOn?: RegExp; err?: unknown; rows?: unknown[]; rowCount?: number } = {}) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (opts.failOn?.test(sql)) throw opts.err;
      return { rows: opts.rows ?? [], rowCount: opts.rowCount ?? 0 };
    },
  };
  return {
    client,
    queries,
    tx: toTx(client as unknown as pg.PoolClient),
    pool: client as unknown as pg.Pool,
  };
}

describe("PgLikeRepository", () => {
  it("insertIfAbsent uses ON CONFLICT DO NOTHING and reports whether a row was inserted", async () => {
    const r1 = recording({ rowCount: 1 });
    const repo = new PgLikeRepository(r1.pool);
    expect(await repo.insertIfAbsent({ postId: POST, userId: USER, createdAt: at }, r1.tx)).toBe(true);
    expect(r1.queries[0]!.sql).toMatch(/ON CONFLICT \(post_id, user_id\) DO NOTHING/);
    expect(r1.queries[0]!.params).toEqual([POST, USER, at]);
    const r0 = recording({ rowCount: 0 });
    expect(
      await new PgLikeRepository(r0.pool).insertIfAbsent(
        { postId: POST, userId: USER, createdAt: at },
        r0.tx,
      ),
    ).toBe(false);
  });

  it("insertIfAbsent: FK violation → NOT_FOUND, other errors rethrown", async () => {
    const fk = recording({ failOn: /INSERT/, err: { code: "23503", constraint: "post_likes_post_id_fkey" } });
    await expect(
      new PgLikeRepository(fk.pool).insertIfAbsent({ postId: POST, userId: USER, createdAt: at }, fk.tx),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const raw = { code: "57014" };
    const other = recording({ failOn: /INSERT/, err: raw });
    await expect(
      new PgLikeRepository(other.pool).insertIfAbsent(
        { postId: POST, userId: USER, createdAt: at },
        other.tx,
      ),
    ).rejects.toBe(raw);
  });

  it("listLikers asks for limit + 1 and builds nextCursor from (liked_at, user id)", async () => {
    const row = (n: number) => ({
      id: `0190a000-0000-7000-8000-00000000000${n}`,
      username: `u${n}`,
      full_name: "",
      avatar_storage_key: null,
      is_following: null,
      liked_at: new Date(at.getTime() - n * 1000),
    });
    const r = recording({ rows: [row(1), row(2), row(3)] });
    const page = await new PgLikeRepository(r.pool).listLikers(POST, null, { cursor: null, limit: 2 });
    expect(r.queries[0]!.params).toEqual([POST, null, null, null, 3]);
    expect(page.items.map((u) => u.username)).toEqual(["u1", "u2"]);
    expect(page.nextCursor).toEqual({ t: row(2).liked_at, id: row(2).id });
  });
});

describe("PgCommentRepository", () => {
  const comment = Comment.create({
    id: "0190a000-0000-7000-b000-000000000001" as CommentId,
    postId: POST,
    authorId: USER,
    text: "hi",
    now: at,
  });

  it("insert: FK violation → NOT_FOUND", async () => {
    const r = recording({ failOn: /INSERT INTO comments/, err: { code: "23503" } });
    await expect(new PgCommentRepository(r.pool).insert(comment, r.tx)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("findLive locks FOR UPDATE only inside a tx", async () => {
    const r = recording();
    const repo = new PgCommentRepository(r.pool);
    await repo.findLive(comment.id, r.tx);
    await repo.findLive(comment.id);
    expect(r.queries[0]!.sql).toMatch(/FOR UPDATE$/);
    expect(r.queries[1]!.sql).not.toMatch(/FOR UPDATE/);
  });

  it("listByPost pages ascending with limit + 1 and no cursor when the page is short", async () => {
    const r = recording({ rows: [] });
    const cursor = { t: at, id: comment.id };
    const page = await new PgCommentRepository(r.pool).listByPost(POST, { cursor, limit: 20 });
    expect(r.queries[0]!.sql).toMatch(/ORDER BY c\.created_at ASC, c\.id ASC/);
    expect(r.queries[0]!.params).toEqual([POST, at, comment.id, 21]);
    expect(page).toEqual({ items: [], nextCursor: null });
  });
});
