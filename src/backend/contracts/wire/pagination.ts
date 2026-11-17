import { z } from "zod";
import { LIMITS } from "./limits.ts";

/**
 * `?cursor=<opaque>&limit=<1..50>` (DEC-10). The cursor is opaque on the wire; decoding it
 * (base64url JSON sort key) and rejecting tampered values is done by `mapPageQueryToRequest`.
 */
export const PageQuery = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(LIMITS.pageLimitMax).default(LIMITS.pageLimitDefault),
  })
  .strict();
export type PageQuery = z.infer<typeof PageQuery>;

/** `{ items: T[], next_cursor: string | null }` */
export function page<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    next_cursor: z.string().nullable(),
  });
}

export type Page<T> = { items: T[]; next_cursor: string | null };
