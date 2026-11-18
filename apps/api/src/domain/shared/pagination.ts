/** Keyset pagination types (`DEC-10`). Cursor encoding/decoding lives in `api/` mappers. */
export type PageRequest<C> = { cursor: C | null; limit: number };
export type Page<T, C> = { items: T[]; nextCursor: C | null };

/** Sort key `(t, id)` for every time-ordered list. `id` is the row UUID (tie-break). */
export type TimeCursor = { t: Date; id: string };
