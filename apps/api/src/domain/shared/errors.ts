/**
 * Domain copy of the wire error codes. Must stay identical to `ERROR_CODES` in
 * `packages/contracts/src/errors.ts` (domain may not import contracts; a unit test asserts equality).
 */
export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "FORBIDDEN",
  "NOT_FOUND",
  "USERNAME_TAKEN",
  "EMAIL_TAKEN",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "MEDIA_INVALID",
  "CANNOT_FOLLOW_SELF",
  "RATE_LIMITED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** The only error type thrown on purpose by domain code; mapped to `ErrorResponseDto` by `api/server.ts`. */
export class DomainError extends Error {
  override readonly name = "DomainError";

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}

/**
 * Thrown by w00 service skeletons until the owning wave implements the method.
 * Surfaces as `500 INTERNAL` through the central error handler.
 */
export function notImplemented(method: string): never {
  throw new DomainError("INTERNAL", `${method} is not implemented yet`);
}
