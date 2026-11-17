import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PgUnitOfWork, queryable } from "../../../src/data/db/tx.js";
import type { DomainEvent } from "../../../src/domain/shared/events.js";
import type { UserId } from "../../../src/domain/shared/ids.js";
import { closeTestPool, getTestPool, insertUser, resetDb } from "../../helpers/index.js";

/** F-ICOMM-02 against a real database: events are published only after COMMIT. */
describe("PgUnitOfWork + PostgreSQL", () => {
  const pool = getTestPool();

  beforeAll(async () => {
    await resetDb(pool);
  });
  afterAll(async () => {
    await closeTestPool();
  });

  const followed = (a: string, b: string): DomainEvent => ({
    type: "UserFollowed",
    followerId: a as UserId,
    followeeId: b as UserId,
    at: new Date(),
  });

  it("commit persists the write, then publishes", async () => {
    const [a, b] = [await insertUser(pool), await insertUser(pool)];
    const publish = vi.fn();
    const uow = new PgUnitOfWork(pool, { publish });
    await uow.run(async (tx, events) => {
      await queryable(pool, tx).query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)", [
        a!.id,
        b!.id,
      ]);
      events.add(followed(a!.id, b!.id));
    });
    expect(publish).toHaveBeenCalledWith(
      [followed(a!.id, b!.id)].map((e) => ({ ...e, at: expect.any(Date) })),
    );
    const { rows } = await pool.query("SELECT 1 FROM follows WHERE follower_id = $1", [a!.id]);
    expect(rows).toHaveLength(1);
  });

  it("rollback (failing repo) persists nothing and publishes nothing", async () => {
    const [a, b] = [await insertUser(pool), await insertUser(pool)];
    const publish = vi.fn();
    const uow = new PgUnitOfWork(pool, { publish });
    await expect(
      uow.run(async (tx, events) => {
        await queryable(pool, tx).query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)", [
          a.id,
          b.id,
        ]);
        events.add(followed(a.id, b.id));
        // Self-follow violates follows_check → the whole unit rolls back.
        await queryable(pool, tx).query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $1)", [
          a.id,
        ]);
      }),
    ).rejects.toMatchObject({ code: "23514" });
    expect(publish).not.toHaveBeenCalled();
    const { rows } = await pool.query("SELECT 1 FROM follows WHERE follower_id = $1", [a.id]);
    expect(rows).toHaveLength(0);
  });
});
