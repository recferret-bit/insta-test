import { fromPublicId, toPublicId, type IdPrefix, type PageQuery } from "@insta/contracts";

import { DomainError } from "../../domain/shared/errors.js";
import type { Page, PageRequest, TimeCursor } from "../../domain/shared/pagination.js";

/**
 * Cross-module DTO helpers: public IDs (`DEC-04`) and keyset cursors (`DEC-10`).
 * Feature mappers (`<module>.dto-mapper.ts`) build on these.
 */

export { toPublicId };

/**
 * Public ID → canonical UUID (branded by the caller's type parameter).
 * Wrong prefix or format → `400 VALIDATION_FAILED` with a `details[]` entry for `path`.
 */
export function parsePublicId<T extends string>(prefix: IdPrefix, value: string, path = "id"): T {
  const uuid = fromPublicId(prefix, value);
  if (uuid === null) {
    throw new DomainError("VALIDATION_FAILED", "Request validation failed", [
      { path, message: `Must be a valid ${prefix}_ identifier` },
    ]);
  }
  return uuid as T;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function badCursor(): DomainError {
  return new DomainError("VALIDATION_FAILED", "Request validation failed", [
    { path: "cursor", message: "Invalid cursor" },
  ]);
}

/** `{ t, id }` → base64url(JSON) with ISO time, e.g. `{"t":"2026-11-17T10:00:00.000Z","id":"<uuid>"}`. */
export function encodeCursor(cursor: TimeCursor): string {
  return Buffer.from(JSON.stringify({ t: cursor.t.toISOString(), id: cursor.id }), "utf8").toString(
    "base64url",
  );
}

/** Tampered/undecodable cursor → `400 VALIDATION_FAILED`. */
export function decodeCursor(raw: string): TimeCursor {
  if (!/^[A-Za-z0-9_-]+$/.test(raw)) throw badCursor();
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw badCursor();
  }
  if (typeof parsed !== "object" || parsed === null) throw badCursor();
  const { t, id } = parsed as { t?: unknown; id?: unknown };
  if (typeof t !== "string" || typeof id !== "string" || !UUID_PATTERN.test(id)) throw badCursor();
  const time = new Date(t);
  if (Number.isNaN(time.getTime()) || time.toISOString() !== t) throw badCursor();
  return { t: time, id };
}

/** `?cursor&limit` (already validated by `PageQuery`) → domain `PageRequest`. */
export function mapPageQueryToRequest(query: PageQuery): PageRequest<TimeCursor> {
  return { cursor: query.cursor ? decodeCursor(query.cursor) : null, limit: query.limit };
}

/** Domain page → `{ items, next_cursor }` wire wrapper. */
export function mapPageToResponseDto<T, D>(
  page: Page<T, TimeCursor>,
  mapItem: (item: T) => D,
): { items: D[]; next_cursor: string | null } {
  return {
    items: page.items.map(mapItem),
    next_cursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
  };
}
