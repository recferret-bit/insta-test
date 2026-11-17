import type pg from "pg";

import {
  BufferedEventCollector,
  type DomainEventPublisher,
  type EventCollector,
} from "../../domain/shared/events.js";
import type { Tx, UnitOfWork } from "../../domain/shared/unit-of-work.js";

/** What a `Tx` handle really is; only `data/` unwraps it. */
type PgTx = { readonly client: pg.PoolClient };

/** Anything that can run a query: the pool or a transaction-bound client. */
export type Queryable = Pick<pg.Pool, "query"> | Pick<pg.PoolClient, "query">;

/** Repositories call this: the tx client when inside `UnitOfWork.run`, else the pool. */
export function queryable(pool: pg.Pool, tx?: Tx): Queryable {
  return tx ? (tx as unknown as PgTx).client : pool;
}

/** Wraps a checked-out client as an opaque `Tx` (exported for tests and the migration runner). */
export function toTx(client: pg.PoolClient): Tx {
  const handle: PgTx = { client };
  return handle as unknown as Tx;
}

/**
 * `UnitOfWork` over one pooled client: `BEGIN` → fn(tx, events) → `COMMIT` → publish events.
 * Any throw (including a failed `COMMIT`) rolls back and discards the collected events (`F-ICOMM-02`).
 */
export class PgUnitOfWork implements UnitOfWork {
  constructor(
    private readonly pool: pg.Pool,
    private readonly publisher: DomainEventPublisher,
  ) {}

  async run<T>(fn: (tx: Tx, events: EventCollector) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const collector = new BufferedEventCollector();
    let result: T;
    try {
      await client.query("BEGIN");
      result = await fn(toTx(client), collector);
      await client.query("COMMIT");
    } catch (err) {
      let releaseError: Error | undefined;
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        // Broken connection: destroy it instead of returning it to the pool.
        releaseError = rollbackErr instanceof Error ? rollbackErr : new Error(String(rollbackErr));
      }
      client.release(releaseError);
      collector.drain();
      throw err;
    }
    client.release();
    const events = collector.drain();
    if (events.length > 0) this.publisher.publish(events);
    return result;
  }
}
