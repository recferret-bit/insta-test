import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_MIGRATIONS_DIR,
  loadMigrationFiles,
  MigrationError,
  runMigrations,
} from "../../../src/data/db/migrate.js";
import { closeTestPool, getTestPool } from "../../helpers/index.js";

/** F-DB-02: forward-only runner with checksums and an advisory lock. */
describe("migration runner (F-DB-02)", () => {
  const pool = getTestPool();
  let dir: string;

  async function wipe(): Promise<void> {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
  }

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "migrations-"));
  });
  beforeEach(async () => {
    await rm(dir, { recursive: true, force: true });
    await cp(DEFAULT_MIGRATIONS_DIR, dir, { recursive: true });
    await wipe();
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
    await closeTestPool();
  });

  it("applies every migration on an empty DB and records version, name and checksum", async () => {
    const files = await loadMigrationFiles(dir);
    const result = await runMigrations(pool, { dir });
    expect(result.applied).toEqual(files.map((f) => f.file));
    expect(result.latestVersion).toBe(files.length);
    const { rows } = await pool.query(
      "SELECT version, name, checksum FROM schema_migrations ORDER BY version",
    );
    expect(rows).toEqual(files.map((f) => ({ version: f.version, name: f.name, checksum: f.checksum })));
  });

  it("re-running is a no-op", async () => {
    await runMigrations(pool, { dir });
    const again = await runMigrations(pool, { dir });
    expect(again.applied).toEqual([]);
  });

  it("applies only new files on the next run", async () => {
    await runMigrations(pool, { dir });
    const next = (await loadMigrationFiles(dir)).length + 1;
    const file = `${String(next).padStart(4, "0")}_add_probe.sql`;
    await writeFile(path.join(dir, file), "CREATE TABLE probe_tbl (id int);");
    const result = await runMigrations(pool, { dir });
    expect(result.applied).toEqual([file]);
    expect(result.latestVersion).toBe(next);
  });

  it("editing an applied file aborts with a checksum error and changes nothing", async () => {
    await runMigrations(pool, { dir });
    const first = path.join(dir, "0001_init.sql");
    await writeFile(first, `${await readFile(first, "utf8")}\n-- edited\n`);
    await expect(runMigrations(pool, { dir })).rejects.toThrow(MigrationError);
    await expect(runMigrations(pool, { dir })).rejects.toThrow(/Checksum mismatch.*0001_init\.sql/);
  });

  it("a failing migration rolls back its own changes and is not recorded", async () => {
    await runMigrations(pool, { dir });
    const next = (await loadMigrationFiles(dir)).length + 1;
    const file = `${String(next).padStart(4, "0")}_broken.sql`;
    await writeFile(path.join(dir, file), "CREATE TABLE half_done (id int); SELECT * FROM does_not_exist;");
    await expect(runMigrations(pool, { dir })).rejects.toThrow(new RegExp(`${file} failed`));
    const { rows } = await pool.query(
      "SELECT to_regclass('public.half_done') AS t, max(version) AS v FROM schema_migrations",
    );
    expect(rows[0]).toEqual({ t: null, v: next - 1 });
  });

  it("releases the advisory lock afterwards", async () => {
    await runMigrations(pool, { dir });
    const client = await pool.connect();
    try {
      const { rows } = await client.query("SELECT pg_try_advisory_lock(hashtext('schema_migrations')) AS ok");
      expect(rows[0]?.ok).toBe(true);
      await client.query("SELECT pg_advisory_unlock(hashtext('schema_migrations'))");
    } finally {
      client.release();
    }
  });
});
