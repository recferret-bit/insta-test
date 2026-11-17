/**
 * Stable machine error codes and their HTTP statuses (F-CORE-05, external-communication/01-api-conventions.md).
 * Zod-free; `errors.ts` builds the Zod schemas from this list.
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

export const ERROR_HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  USERNAME_TAKEN: 409,
  EMAIL_TAKEN: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  MEDIA_INVALID: 422,
  CANNOT_FOLLOW_SELF: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};
