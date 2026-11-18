import { toPublicId } from "@insta/contracts";
import { describe, expect, it } from "vitest";

import {
  decodeCursor,
  encodeCursor,
  mapPageQueryToRequest,
  mapPageToResponseDto,
  parsePublicId,
} from "../../../src/api/mappers/shared.dto-mapper.js";
import { DomainError } from "../../../src/domain/shared/errors.js";

const UUID = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

function expectValidationError(fn: () => unknown, path: string): void {
  try {
    fn();
    expect.unreachable("should throw");
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe("VALIDATION_FAILED");
    expect((err as DomainError).details).toEqual([expect.objectContaining({ path })]);
  }
}

describe("parsePublicId", () => {
  it("round-trips with toPublicId", () => {
    const pub = toPublicId("pst", UUID);
    expect(pub).toBe("pst_0193a1b2c3d47e5f8a9b0c1d2e3f4a5b");
    expect(parsePublicId("pst", pub)).toBe(UUID);
  });

  it("wrong prefix → VALIDATION_FAILED with the given path", () => {
    expectValidationError(() => parsePublicId("pst", toPublicId("usr", UUID), "post_id"), "post_id");
  });

  it.each(["", "pst_", "pst_XYZ", `pst_${"a".repeat(31)}`, `pst_${"a".repeat(33)}`, `PST_${"a".repeat(32)}`])(
    "malformed %j → VALIDATION_FAILED",
    (value) => expectValidationError(() => parsePublicId("pst", value), "id"),
  );
});

describe("cursor codec", () => {
  const cursor = { t: new Date("2026-11-17T10:00:00.000Z"), id: UUID };

  it("round-trips and is base64url JSON of {t,id}", () => {
    const raw = encodeCursor(cursor);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(JSON.parse(Buffer.from(raw, "base64url").toString())).toEqual({
      t: "2026-11-17T10:00:00.000Z",
      id: UUID,
    });
    expect(decodeCursor(raw)).toEqual(cursor);
  });

  it.each([
    ["not base64", "%%%"],
    ["not json", Buffer.from("hello").toString("base64url")],
    ["bad id", Buffer.from(JSON.stringify({ t: "2026-11-17T10:00:00.000Z", id: "x" })).toString("base64url")],
    ["bad time", Buffer.from(JSON.stringify({ t: "yesterday", id: UUID })).toString("base64url")],
    ["array", Buffer.from("[]").toString("base64url")],
  ])("tampered cursor (%s) → VALIDATION_FAILED", (_label, raw) => {
    expectValidationError(() => decodeCursor(raw), "cursor");
  });

  it("maps page query and page wrapper", () => {
    expect(mapPageQueryToRequest({ limit: 20 })).toEqual({ cursor: null, limit: 20 });
    expect(mapPageQueryToRequest({ limit: 5, cursor: encodeCursor(cursor) })).toEqual({ cursor, limit: 5 });
    expect(mapPageToResponseDto({ items: [1, 2], nextCursor: null }, (n) => n * 2)).toEqual({
      items: [2, 4],
      next_cursor: null,
    });
    expect(mapPageToResponseDto({ items: [], nextCursor: cursor }, (n: number) => n).next_cursor).toBe(
      encodeCursor(cursor),
    );
  });
});
