import { describe, expect, it } from "vitest";

import {
  formatCompactNumber,
  formatCount,
  formatFullDate,
  formatRelativeTime,
  formatRemaining,
  initialsAvatarUrl,
  initialsFor,
  toPageVM,
  truncate,
} from "./format";

const NOW = new Date("2026-11-17T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("format helpers", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [1234, "1.2K"],
    [1_500_000, "1.5M"],
  ])("formatCompactNumber(%i) = %s", (n, label) => {
    expect(formatCompactNumber(n)).toBe(label);
  });

  it("formatCount pluralizes and groups digits", () => {
    expect(formatCount(0, "like")).toBe("0 likes");
    expect(formatCount(1, "like")).toBe("1 like");
    expect(formatCount(1234, "post")).toBe("1,234 posts");
    expect(formatCount(2, "story", "stories")).toBe("2 stories");
  });

  it.each([
    [0, "now"],
    [59_000, "now"],
    [60_000, "1m"],
    [3 * 3600_000, "3h"],
    [2 * 86400_000, "2d"],
    [14 * 86400_000, "2w"],
    [400 * 86400_000, "1y"],
    [-5000, "now"],
  ])("formatRelativeTime(%i ms ago) = %s", (ms, label) => {
    expect(formatRelativeTime(ago(ms), NOW)).toBe(label);
  });

  it("formatRelativeTime tolerates invalid input", () => {
    expect(formatRelativeTime("garbage", NOW)).toBe("now");
  });

  it("formatFullDate renders a long date and '' for invalid input", () => {
    expect(formatFullDate("2026-11-17T12:00:00.000Z")).toMatch(/2026/);
    expect(formatFullDate("nope")).toBe("");
  });

  it("formatRemaining", () => {
    expect(formatRemaining("2026-11-18T11:00:00.000Z", NOW)).toBe("23h left");
    expect(formatRemaining("2026-11-17T12:15:00.000Z", NOW)).toBe("15m left");
    expect(formatRemaining("2026-11-17T12:00:30.000Z", NOW)).toBe("<1m left");
    expect(formatRemaining("2026-11-17T11:00:00.000Z", NOW)).toBe("expired");
  });

  it("truncate counts code points and appends an ellipsis", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello world", 5)).toBe("hello…");
    expect(truncate("😀😀😀", 2)).toBe("😀😀…");
  });

  it("initials and generated avatar", () => {
    expect(initialsFor("alice", "Alice Liddell")).toBe("AL");
    expect(initialsFor("bob", "")).toBe("B");
    const url = initialsAvatarUrl("alice", "<Al>");
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(url)).not.toContain("<Al>");
    expect(initialsAvatarUrl("alice")).toBe(initialsAvatarUrl("alice"));
  });

  it("toPageVM maps items and keeps the opaque cursor", () => {
    expect(toPageVM({ items: [1, 2], next_cursor: "c" }, (n) => n * 2)).toEqual({
      items: [2, 4],
      nextCursor: "c",
    });
    expect(toPageVM({ items: [], next_cursor: null }, String)).toEqual({ items: [], nextCursor: null });
  });
});
