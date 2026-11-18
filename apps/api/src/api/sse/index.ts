import type { SessionId } from "../../domain/shared/ids.js";
import type { DomainEvent } from "../../domain/shared/events.js";

/**
 * SSE hub (internal-communication/02-domain-events-and-sse.md#sse-protocol) — w00 no-op, implemented by w06
 * (ticket store, per-user connection sets, heartbeats). `main.ts` subscribes `handle` to the
 * `InProcessEventBus` and calls `closeAll` on shutdown, so w06 only fills this module.
 */
export interface SseHub {
  /** Domain event fan-out entry point (called after commit by the event bus). */
  handle(event: DomainEvent): void | Promise<void>;
  /** Logout closes that session's streams. */
  closeSession(sessionId: SessionId): void;
  /** Graceful shutdown: close every open stream. */
  closeAll(): void;
  /** Open connection count (diagnostics/tests). */
  connectionCount(): number;
}

export type SseHubDeps = {
  /** Clock used for ticket expiry (w06). */
  now?: () => Date;
};

export function createSseHub(deps: SseHubDeps = {}): SseHub {
  return {
    handle: () => undefined,
    closeSession: () => undefined,
    closeAll: () => undefined,
    connectionCount: () => 0,
  };
}
