/** Cross-cutting domain ports and paging types (backend/01-business-entities.md "Shared Types"). */

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  /** Time-ordered UUIDv7 in canonical dashed form. */
  uuidv7(): string;
}

export type PageRequest<C> = { cursor: C | null; limit: number };
export type Page<T, C> = { items: T[]; nextCursor: C | null };

/** Keyset cursor for `(created_at, id)` orderings (DEC-10). */
export type TimeCursor = { t: Date; id: string };
