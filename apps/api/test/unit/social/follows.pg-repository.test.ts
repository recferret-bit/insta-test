import type pg from "pg";
import { describe, expect, it } from "vitest";

import { PgFollowRepository } from "../../../src/data/repositories/follows.pg-repository.js";
import type { UserId } from "../../../src/domain/shared/ids.js";
import type { Tx } from "../../../src/domain/shared/unit-of-work.js";
import { Follow } from "../../../src/domain/social/follow.entity.js";

const A = "0190a000-0000-7000-8000-000000000001" as UserId;
const B = "0190a000-0000-7000-8000-000000000002" as UserId;
const follow = Follow.create(A, B, new Date("2026-11-18T12:00:00.000Z"));

type Call = { sql: string; params: unknown[] };

/** A pool whose `query` records calls and returns canned results (or throws). */
function stubPool(result: { rows?: unknown[]; rowCount?: number } | Error, calls: Call[] = []): pg.Pool {
  return {
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      if (result instanceof Error) throw result;
      return { rows: result.rows ?? [], rowCount: result.rowCount ?? 0 };
    },
  } as unknown as pg.Pool;
}

/** Repositories unwrap `Tx` to its client; give it the same stub. */
const txOf = (pool: pg.Pool) => ({ client: pool }) as unknown as Tx;

function pgErr(code: string, constraint: string): Error {
  return Object.assign(new Error(code), { code, constraint });
}

describe("PgFollowRepository writes", () => {
  it("insertIfAbsent → true on insert, false on conflict; uses ON CONFLICT DO NOTHING", async () => {
    const calls: Call[] = [];
    const inserted = stubPool({ rowCount: 1 }, calls);
    await expect(new PgFollowRepository(inserted).insertIfAbsent(follow, txOf(inserted))).resolves.toBe(true);
    expect(calls[0]!.sql).toMatch(/ON CONFLICT \(follower_id, followee_id\) DO NOTHING/);
    expect(calls[0]!.params).toEqual([A, B, follow.createdAt]);

    const conflict = stubPool({ rowCount: 0 });
    await expect(new PgFollowRepository(conflict).insertIfAbsent(follow, txOf(conflict))).resolves.toBe(
      false,
    );
  });

  it.each([
    [pgErr("23514", "follows_check"), "CANNOT_FOLLOW_SELF"],
    [pgErr("23503", "follows_followee_id_fkey"), "NOT_FOUND"],
  ])("insertIfAbsent translates %o", async (err, code) => {
    const pool = stubPool(err);
    await expect(new PgFollowRepository(pool).insertIfAbsent(follow, txOf(pool))).rejects.toMatchObject({
      code,
    });
  });

  it("insertIfAbsent passes other errors through", async () => {
    const err = pgErr("40P01", "");
    const pool = stubPool(err);
    await expect(new PgFollowRepository(pool).insertIfAbsent(follow, txOf(pool))).rejects.toBe(err);
  });

  it("deleteIfPresent reports whether a row was removed", async () => {
    const yes = stubPool({ rowCount: 1 });
    const no = stubPool({ rowCount: 0 });
    await expect(new PgFollowRepository(yes).deleteIfPresent(A, B, txOf(yes))).resolves.toBe(true);
    await expect(new PgFollowRepository(no).deleteIfPresent(A, B, txOf(no))).resolves.toBe(false);
  });
});

describe("PgFollowRepository lists", () => {
  const row = (id: string, at: string) => ({
    id,
    username: `u${id.slice(-1)}`,
    full_name: "U",
    avatar_storage_key: null,
    is_following: false,
    relation_at: new Date(at),
  });

  it("fetches limit + 1 and returns a cursor of the last item when more rows exist", async () => {
    const calls: Call[] = [];
    const pool = stubPool(
      {
        rows: [
          row("0190a000-0000-7000-8000-000000000005", "2026-11-18T12:00:03.000Z"),
          row("0190a000-0000-7000-8000-000000000004", "2026-11-18T12:00:02.000Z"),
          row("0190a000-0000-7000-8000-000000000003", "2026-11-18T12:00:01.000Z"),
        ],
      },
      calls,
    );
    const page = await new PgFollowRepository(pool).listFollowers(B, A, { cursor: null, limit: 2 });
    expect(calls[0]!.params).toEqual([B, A, null, null, 3]);
    expect(calls[0]!.sql).toMatch(/JOIN users u ON u.id = f.follower_id/);
    expect(calls[0]!.sql).toMatch(/WHERE f.followee_id = \$1/);
    expect(page.items.map((i) => i.id)).toEqual([
      "0190a000-0000-7000-8000-000000000005",
      "0190a000-0000-7000-8000-000000000004",
    ]);
    expect(page.items[0]).toMatchObject({
      viewerIsFollowing: false,
      relationAt: new Date("2026-11-18T12:00:03.000Z"),
    });
    expect(page.nextCursor).toEqual({
      t: new Date("2026-11-18T12:00:02.000Z"),
      id: "0190a000-0000-7000-8000-000000000004",
    });
  });

  it("last page has no cursor; following list joins the followee side and passes the cursor", async () => {
    const calls: Call[] = [];
    const pool = stubPool(
      { rows: [row("0190a000-0000-7000-8000-000000000003", "2026-11-18T12:00:01.000Z")] },
      calls,
    );
    const cursor = { t: new Date("2026-11-18T12:00:02.000Z"), id: B };
    const page = await new PgFollowRepository(pool).listFollowing(A, null, { cursor, limit: 2 });
    expect(page.nextCursor).toBeNull();
    expect(calls[0]!.sql).toMatch(/JOIN users u ON u.id = f.followee_id/);
    expect(calls[0]!.params).toEqual([A, null, cursor.t, B, 3]);
  });
});
