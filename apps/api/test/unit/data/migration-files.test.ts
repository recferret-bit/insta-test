import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_MIGRATIONS_DIR,
  latestMigrationVersion,
  loadMigrationFiles,
} from "../../../src/data/db/migrate.js";

describe("loadMigrationFiles", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "migs-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads the real migrations directory starting at 0001_init.sql", async () => {
    const files = await loadMigrationFiles(DEFAULT_MIGRATIONS_DIR);
    expect(files[0]).toMatchObject({ version: 1, name: "init", file: "0001_init.sql" });
    expect(files[0]?.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(await latestMigrationVersion()).toBe(files.length);
  });

  it("orders numerically and checksums raw contents with sha256", async () => {
    await writeFile(path.join(dir, "0002_b.sql"), "SELECT 2;");
    await writeFile(path.join(dir, "0001_a.sql"), "SELECT 1;");
    await writeFile(path.join(dir, "README.md"), "ignored");
    const files = await loadMigrationFiles(dir);
    expect(files.map((f) => f.file)).toEqual(["0001_a.sql", "0002_b.sql"]);
    expect(files[0]?.checksum).toBe(createHash("sha256").update("SELECT 1;").digest("hex"));
  });

  it("rejects gaps", async () => {
    await writeFile(path.join(dir, "0001_a.sql"), "");
    await writeFile(path.join(dir, "0003_c.sql"), "");
    await expect(loadMigrationFiles(dir)).rejects.toThrow(/out of sequence/);
  });

  it("rejects badly named files", async () => {
    await writeFile(path.join(dir, "1_init.sql"), "");
    await expect(loadMigrationFiles(dir)).rejects.toThrow(/Invalid migration file name/);
  });

  it("empty directory → no migrations", async () => {
    await expect(loadMigrationFiles(dir)).resolves.toEqual([]);
    await expect(latestMigrationVersion(dir)).resolves.toBeNull();
  });
});
