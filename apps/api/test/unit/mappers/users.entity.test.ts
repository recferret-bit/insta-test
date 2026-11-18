import { describe, expect, it } from "vitest";

import {
  Email,
  type PasswordHash,
  RESERVED_USERNAMES,
  User,
  Username,
  parseBio,
  parseFullName,
} from "../../../src/domain/identity/user.entity.js";
import { toUserProfileView, toUserSummaryView } from "../../../src/domain/identity/views.js";
import { DomainError } from "../../../src/domain/shared/errors.js";
import type { MediaId, UserId } from "../../../src/domain/shared/ids.js";
import { DOMAIN_LIMITS } from "../../../src/domain/shared/limits.js";

const now = new Date("2026-11-18T10:00:00.000Z");
const later = new Date("2026-11-18T11:00:00.000Z");
const userId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a01" as UserId;
const otherId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a02" as UserId;
const mediaId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a03" as MediaId;

function expectValidationFailed(fn: () => unknown, path: string): void {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe("VALIDATION_FAILED");
    expect((err as DomainError).details).toEqual([{ path, message: expect.any(String) }]);
    return;
  }
  throw new Error("expected VALIDATION_FAILED");
}

function registered(): User {
  return User.register({
    id: userId,
    username: "Alice",
    email: "Alice@Example.COM",
    passwordHash: "$argon2id$hash" as PasswordHash,
    fullName: "  Alice Liddell ",
    now,
  });
}

describe("Username.parse", () => {
  it.each([
    ["alice", "alice"],
    ["  Alice.Smith_1 ", "alice.smith_1"],
    ["abc", "abc"],
    ["a".repeat(30), "a".repeat(30)],
    ["a.b", "a.b"],
    ["_x_", "_x_"],
  ])("accepts %j → %j", (raw, expected) => {
    expect(Username.parse(raw)).toBe(expected);
  });

  it.each(["ab", "a".repeat(31), "", "   ", "al ice", "al-ice", "álice", ".alice", "alice.", "a@b"])(
    "rejects %j",
    (raw) => expectValidationFailed(() => Username.parse(raw), "username"),
  );

  it("rejects every reserved name, case-insensitively", () => {
    expect([...RESERVED_USERNAMES]).toEqual(
      expect.arrayContaining(["api", "admin", "explore", "me", "login", "signup", "settings"]),
    );
    for (const name of ["Explore", "API", "notifications", "create"]) {
      expectValidationFailed(() => Username.parse(name), "username");
    }
  });
});

describe("Email.parse", () => {
  it("trims and lowercases", () => {
    expect(Email.parse("  Bob@Example.COM ")).toBe("bob@example.com");
  });

  it("accepts exactly 254 chars and rejects 255", () => {
    const at254 = `${"a".repeat(254 - "@ex.io".length)}@ex.io`;
    expect(at254).toHaveLength(DOMAIN_LIMITS.emailMax);
    expect(Email.parse(at254)).toBe(at254);
    expectValidationFailed(() => Email.parse(`a${at254}`), "email");
  });

  it.each(["", "bob", "bob@", "@example.com", "bob@example", "bo b@example.com", "a@b@c.com"])(
    "rejects %j",
    (raw) => expectValidationFailed(() => Email.parse(raw), "email"),
  );
});

describe("parseFullName / parseBio", () => {
  it("full name: trimmed, 0–60", () => {
    expect(parseFullName("  ")).toBe("");
    expect(parseFullName(` ${"x".repeat(60)} `)).toHaveLength(60);
    expectValidationFailed(() => parseFullName("x".repeat(61)), "full_name");
  });

  it("bio: 0–150 chars, at most 4 newlines, kept as typed", () => {
    expect(parseBio("")).toBe("");
    expect(parseBio(" hi\n")).toBe(" hi\n");
    expect(parseBio("x".repeat(150))).toHaveLength(150);
    expect(parseBio("1\n2\n3\n4\n5")).toBe("1\n2\n3\n4\n5");
    expectValidationFailed(() => parseBio("x".repeat(151)), "bio");
    expectValidationFailed(() => parseBio("1\n2\n3\n4\n5\n6"), "bio");
  });
});

describe("User.register", () => {
  it("normalizes fields and starts with zero counters, empty bio, no avatar", () => {
    expect(registered()).toEqual({
      id: userId,
      username: "alice",
      email: "alice@example.com",
      passwordHash: "$argon2id$hash",
      fullName: "Alice Liddell",
      bio: "",
      avatarMediaId: null,
      stats: { posts: 0, followers: 0, following: 0 },
      createdAt: now,
      updatedAt: now,
    });
  });

  it("rejects an invalid username, email or full name", () => {
    const base = { id: userId, passwordHash: "h" as PasswordHash, fullName: "", now };
    expectValidationFailed(() => User.register({ ...base, username: "me", email: "a@b.co" }), "username");
    expectValidationFailed(() => User.register({ ...base, username: "alice", email: "nope" }), "email");
    expectValidationFailed(
      () => User.register({ ...base, username: "alice", email: "a@b.co", fullName: "x".repeat(61) }),
      "full_name",
    );
  });
});

describe("User.updateProfile", () => {
  it("applies only the given fields and bumps updatedAt", () => {
    const user = registered();
    const updated = User.updateProfile(user, { bio: "Down the\nrabbit hole", avatarMediaId: mediaId }, later);
    expect(updated).toEqual({
      ...user,
      bio: "Down the\nrabbit hole",
      avatarMediaId: mediaId,
      updatedAt: later,
    });
    expect(user.bio).toBe(""); // input not mutated
  });

  it("normalizes a new username and full name; null removes the avatar", () => {
    const withAvatar = User.updateProfile(registered(), { avatarMediaId: mediaId }, now);
    const updated = User.updateProfile(
      withAvatar,
      { username: " Alice_2 ", fullName: " A ", avatarMediaId: null },
      later,
    );
    expect(updated).toMatchObject({
      username: "alice_2",
      fullName: "A",
      avatarMediaId: null,
      createdAt: now,
    });
  });

  it("rejects invalid changes", () => {
    expectValidationFailed(
      () => User.updateProfile(registered(), { username: "settings" }, later),
      "username",
    );
    expectValidationFailed(() => User.updateProfile(registered(), { bio: "\n\n\n\n\n" }, later), "bio");
  });
});

describe("identity views", () => {
  const user = { ...registered(), avatarMediaId: mediaId, stats: { posts: 3, followers: 2, following: 1 } };

  it("summary: viewer flag only for another signed-in viewer", () => {
    const ctx = { avatarStorageKey: "2026/11/a.jpg", viewerIsFollowing: true };
    expect(toUserSummaryView(user, { ...ctx, viewerId: otherId })).toEqual({
      id: userId,
      username: "alice",
      fullName: "Alice Liddell",
      avatarStorageKey: "2026/11/a.jpg",
      viewerIsFollowing: true,
    });
    expect(toUserSummaryView(user, { ...ctx, viewerId: null }).viewerIsFollowing).toBeNull();
    expect(toUserSummaryView(user, { ...ctx, viewerId: userId }).viewerIsFollowing).toBeNull();
  });

  it("profile: email only for the user's own view", () => {
    const ctx = { avatarStorageKey: null, viewerIsFollowing: false, hasActiveStory: true };
    const own = toUserProfileView(user, { ...ctx, viewerId: userId });
    expect(own).toMatchObject({
      email: "alice@example.com",
      viewerIsFollowing: null,
      stats: { posts: 3, followers: 2, following: 1 },
      hasActiveStory: true,
      createdAt: now,
    });
    const other = toUserProfileView(user, { ...ctx, viewerId: otherId });
    expect(other).not.toHaveProperty("email");
    expect(other.viewerIsFollowing).toBe(false);
    expect(other).not.toHaveProperty("passwordHash");
  });
});
