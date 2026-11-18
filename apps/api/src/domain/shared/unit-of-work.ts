import type { EventCollector } from "./events.js";

declare const txBrand: unique symbol;

/** Opaque transaction handle; only `data/db` knows what is inside. */
export type Tx = { readonly [txBrand]: true };

/**
 * Transaction boundary port. `run` opens `BEGIN`, passes the tx handle and a tx-scoped
 * `EventCollector`, commits, then publishes collected events via `DomainEventPublisher`.
 * On any throw it rolls back and discards the collected events (`F-ICOMM-02`).
 */
export interface UnitOfWork {
  run<T>(fn: (tx: Tx, events: EventCollector) => Promise<T>): Promise<T>;
}
