import { describe, expect, it } from "vitest";

import type { UserSummaryView } from "../../../src/domain/identity/views.js";
import type { Username } from "../../../src/domain/identity/user.entity.js";
import { DomainError } from "../../../src/domain/shared/errors.js";
import type { UserId } from "../../../src/domain/shared/ids.js";
import { Follow, FollowState } from "../../../src/domain/social/follow.entity.js";
import { toFollowRelationView } from "../../../src/domain/social/views.js";

const alice = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as UserId;
const bob = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c" as UserId;
const now = new Date("2026-11-18T10:00:00.000Z");

describe("Follow.create", () => {
  it("creates a directed relation stamped with now", () => {
    expect(Follow.create(alice, bob, now)).toEqual({ followerId: alice, followeeId: bob, createdAt: now });
    expect(Follow.create(bob, alice, now)).toEqual({ followerId: bob, followeeId: alice, createdAt: now });
  });

  it("rejects self-follow with CANNOT_FOLLOW_SELF (INV-01)", () => {
    let caught: unknown;
    try {
      Follow.create(alice, alice, now);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DomainError);
    expect((caught as DomainError).code).toBe("CANNOT_FOLLOW_SELF");
  });

  it("compares ids by value, not reference", () => {
    const sameAsAlice = `${alice}` as UserId;
    expect(() => Follow.create(alice, sameAsAlice, now)).toThrow(DomainError);
  });
});

describe("FollowState.of", () => {
  it("builds following / not-following states", () => {
    expect(FollowState.of(bob, true, 1)).toEqual({ followeeId: bob, following: true, followersCount: 1 });
    expect(FollowState.of(bob, false, 0)).toEqual({ followeeId: bob, following: false, followersCount: 0 });
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid count %s", (count) => {
    expect(() => FollowState.of(bob, true, count)).toThrow(DomainError);
  });
});

describe("toFollowRelationView", () => {
  it("adds the follow created_at as relationAt and keeps the summary fields", () => {
    const user: UserSummaryView = {
      id: alice,
      username: "alice" as Username,
      fullName: "Alice",
      avatarStorageKey: null,
      viewerIsFollowing: false,
    };
    const follow = Follow.create(alice, bob, now);
    expect(toFollowRelationView(user, follow)).toEqual({ ...user, relationAt: now });
  });
});
