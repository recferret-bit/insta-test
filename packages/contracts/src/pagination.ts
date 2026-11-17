import { z } from "zod";

import { LIMITS } from "./limits.js";

/**
 * `?cursor=<opaque>&limit=<1..50>` (default 20). The cursor is base64url(JSON sort key); it is
 * opaque to clients and decoded by the API (`mapPageQueryToRequest`), where a bad cursor → 400.
 */
export const PageQuery = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(LIMITS.pageLimitMax).default(LIMITS.pageLimitDefault),
  })
  .strict();
export type PageQuery = z.infer<typeof PageQuery>;

/** Response wrapper factory: `{ items: T[]; next_cursor: string | null }`. */
export function page<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    next_cursor: z.string().nullable(),
  });
}

export type Page<T> = { items: T[]; next_cursor: string | null };
