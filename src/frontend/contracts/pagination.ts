// Cursor pagination. Source: docs/specs/external-communication/01-api-conventions.md.

export type Page<T> = { items: T[]; next_cursor: string | null };

export type PageQuery = { cursor?: string; limit?: number };

export const PAGE_LIMIT = { min: 1, max: 50, default: 20 } as const;

/** Search endpoints use a smaller window (external-communication/06). */
export const SEARCH_LIMIT = { min: 1, max: 30 } as const;

/** Clamp a requested page size into the allowed range; non-integers fall back to default. */
export function normalizeLimit(
  limit: number | undefined,
  range: { min: number; max: number; default?: number } = PAGE_LIMIT,
): number {
  const fallback = range.default ?? range.max;
  if (limit === undefined || !Number.isInteger(limit)) return fallback;
  return Math.min(range.max, Math.max(range.min, limit));
}
