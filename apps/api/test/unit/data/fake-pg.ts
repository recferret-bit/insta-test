import type pg from "pg";

/** Minimal in-memory stand-in for `pg.Pool`/`PoolClient` that records SQL and can fail on demand. */
export class FakeClient {
  readonly queries: string[] = [];
  released = false;
  releaseArg: unknown;
  failOn: RegExp | null = null;
  rowsFor: (sql: string) => unknown[] = () => [];

  async query(sql: string): Promise<{ rows: unknown[] }> {
    this.queries.push(sql);
    if (this.failOn?.test(sql)) throw new Error(`fake failure on ${sql}`);
    return { rows: this.rowsFor(sql) };
  }

  release(arg?: unknown): void {
    this.released = true;
    this.releaseArg = arg;
  }
}

export function fakePool(client: FakeClient): pg.Pool {
  return { connect: async () => client } as unknown as pg.Pool;
}
