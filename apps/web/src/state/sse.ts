/**
 * Live connection manager — w00 no-op stub mounted by the shell. w06 (`state/sse*`) implements the SSE client from
 * frontend/02 "SSE Client": ticket → `EventSource`, `ServerEvent.safeParse`, LRU dedupe (200), dispatch to caches,
 * exponential backoff 1 s → 30 s with jitter, close on logout.
 */
import { useEffect } from "react";

export type LiveConnectionStatus = "idle" | "connecting" | "open" | "reconnecting";

/** Mount once in the authenticated shell; `enabled` follows the session. w00: does nothing. */
export function useLiveConnection(enabled: boolean): LiveConnectionStatus {
  useEffect(() => {
    if (!enabled) return;
    return () => {
      /* w06: close the EventSource here */
    };
  }, [enabled]);
  return "idle";
}
