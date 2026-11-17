import { describe, expect, it } from "vitest";

import { ApiError } from "../../api/http";
import { GENERIC_ERROR_MESSAGE, mapApiErrorToFormErrors } from "./errors";

function apiError(
  status: number,
  code: string,
  message: string,
  details?: Array<{ path: string; message: string }>,
) {
  return new ApiError(status, {
    error: { code: code as never, message, request_id: "req-1234", ...(details ? { details } : {}) },
  });
}

const fieldMap = { username: "username", email: "email", full_name: "fullName", media_ids: "media" } as const;

describe("mapApiErrorToFormErrors", () => {
  it("maps VALIDATION_FAILED details to fields (exact path or first segment)", () => {
    const result = mapApiErrorToFormErrors(
      apiError(400, "VALIDATION_FAILED", "Request validation failed", [
        { path: "username", message: "Too short" },
        { path: "username", message: "second message ignored" },
        { path: "media_ids.3", message: "Bad id" },
        { path: "password", message: "Too weak" },
      ]),
      fieldMap,
    );
    expect(result.fieldErrors).toEqual({ username: "Too short", media: "Bad id" });
    expect(result.formError).toBe("Too weak");
  });

  it.each([
    ["USERNAME_TAKEN", "username"],
    ["EMAIL_TAKEN", "email"],
  ])("maps %s onto %s", (code, field) => {
    const result = mapApiErrorToFormErrors(apiError(409, code, "Taken"), fieldMap);
    expect(result).toEqual({ fieldErrors: { [field]: "Taken" }, formError: null });
  });

  it("falls back to formError when the conflict field is not on the form", () => {
    expect(mapApiErrorToFormErrors(apiError(409, "EMAIL_TAKEN", "Taken"), {}).formError).toBe("Taken");
  });

  it("uses the server message for other API errors", () => {
    expect(
      mapApiErrorToFormErrors(apiError(401, "INVALID_CREDENTIALS", "Wrong login or password"), fieldMap),
    ).toEqual({
      fieldErrors: {},
      formError: "Wrong login or password",
    });
  });

  it("uses a generic message for non-API errors", () => {
    expect(mapApiErrorToFormErrors(new TypeError("x"), fieldMap).formError).toBe(GENERIC_ERROR_MESSAGE);
  });
});
