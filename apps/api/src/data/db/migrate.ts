import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type pg from "pg";

import { createPool } from "./pool.js";

/**
 * Forward-only migration runner (`F-DB-02`, persistence/02-migrations-and-indexes.md#migration-strategy).
 * 1. `pg_advisory_lock(hashtext('schema_migrations'))` serializes concurrent starters.
 * 2. Ensures `schema_migrations`.
 * 3. Applied files: checksum must match (else fatal). Pending files: run inside `BEGIN … COMMIT`
 *    together with their `schema_migrations` record.
 * 4. Releases the lock.
 */

/** `apps/api/migrations`, resolved identically from `src/data/db` (tsx) and `dist/data/db` (node). */
export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL("../../../migrations", import.meta.url));

const FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/;

export type MigrationFile = { version: number; name: string; file: string; checksum: string; sql: string };

export type MigrationResult = {
  /** File names applied by this run, in order. */
  applied: string[];
  /** Highest version recorded after the run (null if there are no migrations). */
  latestVersion: number | null;
};

export type MigrationLogger = { info(obj: object, msg: string): void };

export class MigrationError extends Error {
  override readonly name = "MigrationError";
}

export function checksumOf(contents: string | Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

/** Reads, validates (`NNNN_snake_name.sql`, strictly increasing from 0001, no gaps) and checksums files. */
export async function loadMigrationFiles(dir: string = DEFAULT_MIGRATIONS_DIR): Promise<MigrationFile[]> {
  const entries = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const files: MigrationFile[] = [];
  for (const file of entries) {
    const match = FILE_PATTERN.exec(file);
    if (!match)
      throw new MigrationError(`Invalid migration file name: ${file} (expected NNNN_snake_name.sql)`);
    const version = Number(match[1]);
    const expected = files.length + 1;
    if (version !== expected) {
      throw new MigrationError(`Migration ${file} is out of sequence (expected version ${expected})`);
    }
    const raw = await readFile(path.join(dir, file));
    files.push({ version, name: match[2] ?? "", file, checksum: checksumOf(raw), sql: raw.toString("utf8") });
  }
  return files;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version     integer     NOT NULL PRIMARY KEY,
    name        text        NOT NULL,
    checksum    text        NOT NULL,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )`;

const LOCK_KEY_SQL = "hashtext('schema_migrations')";

type AppliedRow = { version: number; name: string; checksum: string };

export async function runMigrations(
  pool: pg.Pool,
  options: { dir?: string; logger?: MigrationLogger } = {},
): Promise<MigrationResult> {
  const files = await loadMigrationFiles(options.dir);
  const client = await pool.connect();
  let lockHeld = false;
  let broken: Error | undefined;
  try {
    await client.query(`SELECT pg_advisory_lock(${LOCK_KEY_SQL})`);
    lockHeld = true;
    await client.query(CREATE_TABLE_SQL);
    const { rows } = await client.query<AppliedRow>(
      "SELECT version, name, checksum FROM schema_migrations ORDER BY version",
    );
    const applied = new Map(rows.map((r) => [r.version, r]));

    for (const file of files) {
      const record = applied.get(file.version);
      if (record && record.checksum !== file.checksum) {
        throw new MigrationError(
          `Checksum mismatch for applied migration ${file.file}; applied migrations are immutable — add a new migration instead`,
        );
      }
    }

    const appliedNow: string[] = [];
    for (const file of files) {
      if (applied.has(file.version)) continue;
      try {
        await client.query("BEGIN");
        await client.query(file.sql);
        await client.query("INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)", [
          file.version,
          file.name,
          file.checksum,
        ]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        const reason = err instanceof Error ? err.message : String(err);
        throw new MigrationError(`Migration ${file.file} failed: ${reason}`, { cause: err });
      }
      appliedNow.push(file.file);
      options.logger?.info({ migration: file.file }, "migration applied");
    }

    const latest = await client.query<{ version: number | null }>(
      "SELECT max(version) AS version FROM schema_migrations",
    );
    return { applied: appliedNow, latestVersion: latest.rows[0]?.version ?? null };
  } catch (err) {
    if (!(err instanceof MigrationError)) broken = err instanceof Error ? err : new Error(String(err));
    throw err;
  } finally {
    if (lockHeld) {
      await client.query(`SELECT pg_advisory_unlock(${LOCK_KEY_SQL})`).catch((e: unknown) => {
        broken = e instanceof Error ? e : new Error(String(e));
      });
    }
    client.release(broken);
  }
}

/** Latest version present on disk (what `/api/v1/health` expects to find applied). */
export async function latestMigrationVersion(dir: string = DEFAULT_MIGRATIONS_DIR): Promise<number | null> {
  const files = await loadMigrationFiles(dir);
  return files.at(-1)?.version ?? null;
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

/** CLI: `npm run migrate -w apps/api` (needs `DATABASE_URL`). */
async function cli(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write("DATABASE_URL is required\n");
    process.exit(1);
  }
  const pool = createPool(url, { max: 1, applicationName: "insta-migrate" });
  try {
    const result = await runMigrations(pool, {
      logger: { info: (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`) },
    });
    process.stdout.write(
      `migrations: ${result.applied.length} applied, latest version ${result.latestVersion ?? "none"}\n`,
    );
  } finally {
    await pool.end();
  }
}

if (isMainModule()) {
  cli().catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
