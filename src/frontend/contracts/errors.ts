// Error envelope + code catalog.
// Source: docs/specs/external-communication/01-api-conventions.md.

export const ERROR_STATUS = {
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
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export const ERROR_CODES = Object.keys(ERROR_STATUS) as ErrorCode[];

export type ErrorDetailDto = { path: string; message: string };

export type ErrorResponseDto = {
  error: {
    code: ErrorCode;
    message: string;
    /** Only present for VALIDATION_FAILED. */
    details?: ErrorDetailDto[];
    request_id: string;
  };
};

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.hasOwn(ERROR_STATUS, value);
}

/** Structural guard used by the HTTP client before throwing `ApiError`. */
export function isErrorResponseDto(value: unknown): value is ErrorResponseDto {
  if (typeof value !== "object" || value === null) return false;
  const err = (value as { error?: unknown }).error;
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  if (!isErrorCode(e.code) || typeof e.message !== "string" || typeof e.request_id !== "string") {
    return false;
  }
  if (e.details === undefined) return true;
  return (
    Array.isArray(e.details) &&
    e.details.every(
      (d) =>
        typeof d === "object" &&
        d !== null &&
        typeof (d as ErrorDetailDto).path === "string" &&
        typeof (d as ErrorDetailDto).message === "string",
    )
  );
}

/** Client-side reaction class per frontend/01 "Errors" note. */
export type ErrorReaction = "logout" | "slow_down" | "inline";

export function errorReactionForStatus(status: number): ErrorReaction {
  if (status === 401) return "logout";
  if (status === 429) return "slow_down";
  return "inline";
}
