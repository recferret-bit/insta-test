/**
 * Domain copy of the ErrorCode list. The domain must not import the wire contracts (F-CORE-02),
 * so this list is duplicated and kept equal by test/parity.test.ts.
 */
export const DOMAIN_ERROR_CODES = [
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

export type ErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

/** Thrown by entity factories and services; mapped to `ErrorResponseDto` by the central HTTP error handler. */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
