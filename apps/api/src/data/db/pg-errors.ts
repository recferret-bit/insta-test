/**
 * Helpers for translating `pg` errors into domain errors inside repositories
 * (specs/02-architecture-and-patterns.md#error-handling). Repositories never leak raw pg errors.
 */
type PgErrorLike = { code?: unknown; constraint?: unknown };

function pgError(err: unknown): PgErrorLike | null {
  return typeof err === "object" && err !== null ? (err as PgErrorLike) : null;
}

/** `23505` unique violation, optionally on a specific constraint/index name. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = pgError(err);
  return e?.code === "23505" && (constraint === undefined || e.constraint === constraint);
}

/** `23503` foreign-key violation, optionally on a specific constraint name. */
export function isForeignKeyViolation(err: unknown, constraint?: string): boolean {
  const e = pgError(err);
  return e?.code === "23503" && (constraint === undefined || e.constraint === constraint);
}

/** `23514` check violation, optionally on a specific constraint name. */
export function isCheckViolation(err: unknown, constraint?: string): boolean {
  const e = pgError(err);
  return e?.code === "23514" && (constraint === undefined || e.constraint === constraint);
}
