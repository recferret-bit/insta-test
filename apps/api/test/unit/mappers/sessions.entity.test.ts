import { describe, expect, it } from "vitest";

import { Session, isSessionActive, truncateUserAgent } from "../../../src/domain/identity/session.entity.js";
import { DomainError } from "../../../src/domain/shared/errors.js";
import type { SessionId, UserId } from "../../../src/domain/shared/ids.js";

const now = new Date("2026-11-18T10:00:00.000Z");
const input = {
  id: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as SessionId,
  userId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c" as UserId,
  tokenHash: Buffer.alloc(32, 1),
  userAgent: "Mozilla/5.0",
  now,
  ttlDays: 30,
};

describe("Session.issue", () => {
  it("expires after ttlDays and starts unrevoked", () => {
    const s = Session.issue(input);
    expect(s).toEqual({
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      userAgent: "Mozilla/5.0",
      createdAt: now,
      expiresAt: new Date("2026-12-18T10:00:00.000Z"),
      revokedAt: null,
    });
  });

  it("truncates the user agent to 255 code points", () => {
    expect(Session.issue({ ...input, userAgent: "x".repeat(300) }).userAgent).toHaveLength(255);
    expect(truncateUserAgent("x".repeat(255))).toHaveLength(255);
    expect(truncateUserAgent("")).toBe("");
    const emoji = truncateUserAgent("😀".repeat(256));
    expect(Array.from(emoji)).toHaveLength(255);
    expect(emoji.endsWith("😀")).toBe(true);
  });

  it.each([
    [{ tokenHash: Buffer.alloc(31) }],
    [{ tokenHash: Buffer.alloc(0) }],
    [{ ttlDays: 0 }],
    [{ ttlDays: -1 }],
    [{ ttlDays: Number.NaN }],
  ])("rejects invalid input %#", (override) => {
    expect(() => Session.issue({ ...input, ...override })).toThrow(DomainError);
  });
});

describe("Session.isActive / revoke", () => {
  const s = Session.issue(input);

  it("is active strictly before expiresAt", () => {
    expect(Session.isActive(s, now)).toBe(true);
    expect(Session.isActive(s, new Date(s.expiresAt.getTime() - 1))).toBe(true);
    expect(Session.isActive(s, s.expiresAt)).toBe(false);
    expect(isSessionActive(s, new Date(s.expiresAt.getTime() + 1))).toBe(false);
  });

  it("revoked sessions are inactive; revoke is idempotent", () => {
    const t1 = new Date("2026-11-19T00:00:00.000Z");
    const revoked = Session.revoke(s, t1);
    expect(revoked.revokedAt).toEqual(t1);
    expect(s.revokedAt).toBeNull();
    expect(Session.isActive(revoked, now)).toBe(false);
    expect(Session.revoke(revoked, new Date("2026-11-20T00:00:00.000Z")).revokedAt).toEqual(t1);
  });
});
