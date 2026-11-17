import { z } from "zod";

/**
 * Stable machine error codes (external-communication/01-api-conventions.md#error-code-catalog).
 * `apps/api/src/domain/shared/errors.ts` keeps an identical copy; a unit test asserts equality.
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

export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** HTTP status for every error code. */
export const ERROR_HTTP_STATUS = {
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
} as const satisfies Record<ErrorCode, number>;

export const ValidationIssueDto = z.object({
  path: z.string(),
  message: z.string(),
});
export type ValidationIssueDto = z.infer<typeof ValidationIssueDto>;

/** Error envelope returned by every failing `/api/v1` request. */
export const ErrorResponseDto = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    /** Only present for `VALIDATION_FAILED`. */
    details: z.array(ValidationIssueDto).optional(),
    request_id: z.string(),
  }),
});
export type ErrorResponseDto = z.infer<typeof ErrorResponseDto>;
