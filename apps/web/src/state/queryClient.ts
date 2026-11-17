/**
 * Shared TanStack Query client. Global error policy (frontend/01 "Errors"): `429` → toast "Slow down";
 * `401` is handled once by the API client hook installed in `main.tsx`; other errors render inline with retry.
 */
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { isApiError } from "../api/http";
import { STALE_TIMES, type QueryKeyRoot } from "./query-keys";
import { showToast } from "./toast";
import { RATE_LIMITED_MESSAGE } from "./errors";

const MAX_RETRIES = 2;

/** Retry network failures and 5xx; never retry 4xx (deterministic client errors). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (isApiError(error)) return error.status >= 500;
  return true;
}

function onGlobalError(error: unknown): void {
  if (isApiError(error) && error.status === 429) showToast(RATE_LIMITED_MESSAGE, { tone: "error" });
}

export function staleTimeFor(root: QueryKeyRoot): number {
  return STALE_TIMES[root];
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: onGlobalError }),
    mutationCache: new MutationCache({ onError: onGlobalError }),
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

/** App-wide singleton (tests create their own with `createQueryClient()`). */
export const queryClient = createQueryClient();
