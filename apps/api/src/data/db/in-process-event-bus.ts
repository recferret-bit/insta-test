import type { DomainEvent, DomainEventPublisher } from "../../domain/shared/events.js";

export type DomainEventHandler = (event: DomainEvent) => void | Promise<void>;

/** Minimal logger surface (pino-compatible) so the bus does not depend on Fastify. */
export type EventBusLogger = { error(obj: object, msg: string): void };

/**
 * In-process publisher (internal-communication/02-domain-events-and-sse.md#bus-semantics).
 * Fan-out happens in `queueMicrotask`, so `publish` never blocks or throws into the caller,
 * and a failing handler is logged without affecting the other handlers. At-most-once delivery.
 */
export class InProcessEventBus implements DomainEventPublisher {
  private readonly handlers = new Set<DomainEventHandler>();

  constructor(private readonly logger: EventBusLogger = { error: () => undefined }) {}

  /** Registers a handler; returns an unsubscribe function. */
  subscribe(handler: DomainEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  publish(events: DomainEvent[]): void {
    for (const event of events) {
      for (const handler of this.handlers) {
        queueMicrotask(() => {
          void this.dispatch(handler, event);
        });
      }
    }
  }

  private async dispatch(handler: DomainEventHandler, event: DomainEvent): Promise<void> {
    try {
      await handler(event);
    } catch (err) {
      this.logger.error({ err, event: event.type }, "domain event handler failed");
    }
  }
}
