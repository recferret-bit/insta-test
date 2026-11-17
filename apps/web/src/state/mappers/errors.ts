/**
 * Maps API errors onto form fields (frontend/02 — `mapApiErrorToFormErrors(error, fieldMap)`).
 * `VALIDATION_FAILED.details[].path` → field via `fieldMap` (exact path, then its first segment);
 * `USERNAME_TAKEN` / `EMAIL_TAKEN` → the `username` / `email` path; anything else → `formError`.
 */
import { isApiError } from "../../api/http";

export type FormErrors<F extends string> = {
  fieldErrors: Partial<Record<F, string>>;
  formError: string | null;
};

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

const CONFLICT_PATHS: Partial<Record<string, string>> = {
  USERNAME_TAKEN: "username",
  EMAIL_TAKEN: "email",
};

export function mapApiErrorToFormErrors<F extends string>(
  error: unknown,
  fieldMap: Partial<Record<string, F>>,
): FormErrors<F> {
  const result: FormErrors<F> = { fieldErrors: {}, formError: null };
  if (!isApiError(error)) {
    result.formError = GENERIC_ERROR_MESSAGE;
    return result;
  }
  const resolveField = (path: string): F | undefined => fieldMap[path] ?? fieldMap[path.split(".")[0] ?? ""];

  if (error.code === "VALIDATION_FAILED" && error.details.length > 0) {
    const unmapped: string[] = [];
    for (const issue of error.details) {
      const field = resolveField(issue.path);
      if (field === undefined) unmapped.push(issue.message);
      else result.fieldErrors[field] ??= issue.message;
    }
    if (unmapped.length > 0) result.formError = unmapped.join(" ");
    return result;
  }
  const conflictPath = CONFLICT_PATHS[error.code];
  const conflictField = conflictPath ? resolveField(conflictPath) : undefined;
  if (conflictField !== undefined) {
    result.fieldErrors[conflictField] = error.message;
    return result;
  }
  result.formError = error.message || GENERIC_ERROR_MESSAGE;
  return result;
}
