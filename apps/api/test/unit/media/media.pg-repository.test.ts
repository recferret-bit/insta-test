import type pg from "pg";
import { describe, expect, it } from "vitest";

import { toTx } from "../../../src/data/db/tx.js";
import { PgMediaRepository } from "../../../src/data/repositories/media.pg-repository.js";
import type { MediaAssetRow } from "../../../src/data/rows/media.row.js";
import type { MediaAsset } from "../../../src/domain/media/media-asset.entity.js";
import type { MediaId, UserId } from "../../../src/domain/shared/ids.js";

type Call = { sql: string; params: unknown[] };

/** Records SQL + parameters on both the pool and the tx client. */
function recorder(rows: unknown[] = []) {
  const calls: Call[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return { rows };
  };
  const pool = { query } as unknown as pg.Pool;
  const client = { query } as unknown as pg.PoolClient;
  return { calls, pool, tx: toTx(client) };
}

const ID = "0190a1b2-c3d4-7e5f-8a9b-aaaaaaaaaaaa" as MediaId;
const row: MediaAssetRow = {
  id: ID,
  owner_id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
  purpose: "avatar",
  kind: "image",
  mime_type: "image/png",
  storage_key: `2026/11/${ID}.png`,
  byte_size: "4096",
  width: 3,
  height: 2,
  duration_ms: null,
  status: "uploaded",
  created_at: new Date("2026-11-18T09:00:00.000Z"),
};
const entity: MediaAsset = {
  id: ID,
  ownerId: row.owner_id as UserId,
  purpose: "avatar",
  kind: "image",
  mimeType: "image/png",
  storageKey: row.storage_key,
  byteSize: 4096,
  width: 3,
  height: 2,
  durationMs: null,
  status: "uploaded",
  createdAt: row.created_at,
};

describe("PgMediaRepository (unit, SQL shape)", () => {
  it("insert writes the mapped row (byte_size as decimal string) via the pool", async () => {
    const r = recorder();
    await new PgMediaRepository(r.pool).insert(entity);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]!.sql).toMatch(/INSERT INTO media_assets/);
    expect(r.calls[0]!.params).toEqual([
      ID,
      row.owner_id,
      "avatar",
      "image",
      "image/png",
      row.storage_key,
      "4096",
      3,
      2,
      null,
      "uploaded",
      row.created_at,
    ]);
  });

  it("findManyForUpdate locks via the tx client and maps rows to entities", async () => {
    const r = recorder([row]);
    const found = await new PgMediaRepository(r.pool).findManyForUpdate([ID], r.tx);
    expect(found).toEqual([entity]);
    expect(r.calls[0]!.sql).toMatch(/FOR UPDATE/);
    expect(r.calls[0]!.params).toEqual([[ID]]);
  });

  it("empty id lists are no-ops (no query)", async () => {
    const r = recorder();
    const repo = new PgMediaRepository(r.pool);
    expect(await repo.findManyForUpdate([], r.tx)).toEqual([]);
    await repo.markAttached([], r.tx);
    expect(r.calls).toEqual([]);
  });

  it("markAttached updates status for all ids", async () => {
    const r = recorder();
    await new PgMediaRepository(r.pool).markAttached([ID], r.tx);
    expect(r.calls[0]!.sql).toMatch(/SET status = 'attached'/);
    expect(r.calls[0]!.params).toEqual([[ID]]);
  });

  it("deleteUnattachedOlderThan only targets uploaded rows, skips locked ones, returns entities", async () => {
    const r = recorder([row]);
    const cutoff = new Date("2026-11-17T09:00:00.000Z");
    expect(await new PgMediaRepository(r.pool).deleteUnattachedOlderThan(cutoff, 500)).toEqual([entity]);
    expect(r.calls[0]!.sql).toMatch(/status = 'uploaded' AND created_at < \$1/);
    expect(r.calls[0]!.sql).toMatch(/SKIP LOCKED/);
    expect(r.calls[0]!.sql).toMatch(/RETURNING/);
    expect(r.calls[0]!.params).toEqual([cutoff, 500]);
  });
});
