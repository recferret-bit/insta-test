import { describe, expect, it } from "vitest";

import { ERROR_CODES, ERROR_HTTP_STATUS, ErrorResponseDto, LIMITS } from "../src/index.js";

describe("error codes", () => {
  it("matches the api-conventions catalog exactly", () => {
    expect([...ERROR_CODES].sort()).toEqual(
      [
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
      ].sort(),
    );
  });

  it("maps every code to its HTTP status", () => {
    expect(Object.keys(ERROR_HTTP_STATUS).sort()).toEqual([...ERROR_CODES].sort());
    expect(ERROR_HTTP_STATUS.MEDIA_INVALID).toBe(422);
    expect(ERROR_HTTP_STATUS.INVALID_CREDENTIALS).toBe(401);
    expect(ERROR_HTTP_STATUS.RATE_LIMITED).toBe(429);
  });

  it("parses the error envelope with and without details", () => {
    expect(
      ErrorResponseDto.safeParse({
        error: {
          code: "VALIDATION_FAILED",
          message: "Request validation failed",
          details: [{ path: "caption", message: "too long" }],
          request_id: "abc12345",
        },
      }).success,
    ).toBe(true);
    expect(
      ErrorResponseDto.safeParse({ error: { code: "NOT_FOUND", message: "x", request_id: "r" } }).success,
    ).toBe(true);
    expect(
      ErrorResponseDto.safeParse({ error: { code: "TEAPOT", message: "x", request_id: "r" } }).success,
    ).toBe(false);
  });
});

describe("limits", () => {
  it("equal the DB CHECK constraints in persistence/01-schema.md", () => {
    expect(LIMITS.usernameMax).toBe(30);
    expect(LIMITS.usernameMin).toBe(3);
    expect(LIMITS.emailMax).toBe(254);
    expect(LIMITS.fullNameMax).toBe(60);
    expect(LIMITS.bioMax).toBe(150);
    expect(LIMITS.captionMax).toBe(2200);
    expect(LIMITS.hashtagMax).toBe(64);
    expect(LIMITS.commentMax).toBe(500);
    expect(LIMITS.postMediaMax).toBe(10);
    expect(LIMITS.mediaDimensionMax).toBe(8192);
    expect(LIMITS.videoDurationMsMax).toBe(60000);
    expect(LIMITS.userAgentMax).toBe(255);
    expect(LIMITS.imageBytesMax).toBe(10 * 1024 * 1024);
    expect(LIMITS.videoBytesMax).toBe(50 * 1024 * 1024);
    expect(LIMITS.pageLimitMax).toBe(50);
    expect(LIMITS.storyTtlMs).toBe(86_400_000);
  });
});
