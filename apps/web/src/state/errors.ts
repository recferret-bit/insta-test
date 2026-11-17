/**
 * Error helpers for `ui/` (which must not import `api/` directly): classify errors from queries/mutations.
 */
import { ApiError, isApiError } from "../api/http";

export { ApiError, isApiError };
export { GENERIC_ERROR_MESSAGE, mapApiErrorToFormErrors, type FormErrors } from "./mappers/errors";

export const RATE_LIMITED_MESSAGE = "Slow down";

export function isRateLimited(error: unknown): boolean {
  return isApiError(error) && error.status === 429;
}

export function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

/** Safe, human-readable message for inline error states. */
export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.message || "Request failed.";
  if (error instanceof TypeError) return "Network error. Check your connection.";
  return "Something went wrong. Please try again.";
}
