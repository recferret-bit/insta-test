import { describe, expect, it } from "vitest";

import { hexId, me, profile, userSummary } from "../../test/fixtures";
import {
  toLoginDto,
  toMeVM,
  toProfileVM,
  toSignupDto,
  toUpdateProfileDto,
  toUserSummaryVM,
  withProfileCounts,
} from "./user";

describe("user mappers", () => {
  it("toUserSummaryVM derives profilePath, displayName and a generated avatar", () => {
    const vm = toUserSummaryVM(userSummary({ full_name: "", avatar_url: null }));
    expect(vm.profilePath).toBe("/u/alice");
    expect(vm.displayName).toBe("alice");
    expect(vm.hasCustomAvatar).toBe(false);
    expect(vm.avatarUrl.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("toUserSummaryVM keeps an uploaded avatar and follow state", () => {
    const vm = toUserSummaryVM(userSummary({ avatar_url: "http://x/a.jpg", is_following: true }));
    expect(vm).toMatchObject({ avatarUrl: "http://x/a.jpg", hasCustomAvatar: true, isFollowing: true });
  });

  it("toProfileVM computes isSelf and compact counters", () => {
    const vm = toProfileVM(profile(), hexId("usr", 1));
    expect(vm.isSelf).toBe(true);
    expect(vm.countsLabel).toEqual({ posts: "12", followers: "1.2K", following: "80" });
    expect(vm.countsSummary).toBe("12 posts, 1.2K followers, 80 following");
    expect(vm.hasActiveStory).toBe(true);
    expect(toProfileVM(profile(), null).isSelf).toBe(false);
    expect(toProfileVM(profile(), hexId("usr", 9)).isSelf).toBe(false);
  });

  it("withProfileCounts recomputes labels", () => {
    const vm = withProfileCounts(toProfileVM(profile({ followers_count: 1 }), null), { followersCount: 2 });
    expect(vm.followersCount).toBe(2);
    expect(vm.countsLabel.followers).toBe("2");
    expect(vm.countsSummary).toContain("2 followers");
  });

  it("toMeVM adds email and is always self", () => {
    const vm = toMeVM(me());
    expect(vm.email).toBe("alice@example.com");
    expect(vm.isSelf).toBe(true);
    expect(JSON.parse(JSON.stringify(vm))).toEqual(vm); // persisted in localStorage
  });

  it("toSignupDto / toLoginDto", () => {
    expect(
      toSignupDto({ username: " Alice ", email: " a@b.co ", password: " pw ", fullName: " Al " }),
    ).toEqual({
      username: "alice",
      email: "a@b.co",
      password: " pw ",
      full_name: "Al",
    });
    expect(toLoginDto({ login: " alice ", password: "pw" })).toEqual({ login: "alice", password: "pw" });
  });

  describe("toUpdateProfileDto (only changed fields)", () => {
    const original = toMeVM(me());
    const unchanged = { username: "alice", fullName: "Alice Liddell", bio: "Down the rabbit hole" };

    it("returns null when nothing changed", () => {
      expect(toUpdateProfileDto(unchanged, original)).toBeNull();
      expect(toUpdateProfileDto({ ...unchanged, username: " ALICE " }, original)).toBeNull();
    });

    it("includes only the changed fields", () => {
      expect(toUpdateProfileDto({ ...unchanged, bio: "new", fullName: "A" }, original)).toEqual({
        bio: "new",
        full_name: "A",
      });
    });

    it("handles avatar set and removal", () => {
      const mediaId = hexId("med", 5);
      expect(toUpdateProfileDto({ ...unchanged, avatarMediaId: mediaId }, original)).toEqual({
        avatar_media_id: mediaId,
      });
      expect(toUpdateProfileDto({ ...unchanged, avatarMediaId: null }, original)).toEqual({
        avatar_media_id: null,
      });
      const noAvatar = toMeVM(me({ avatar_url: null }));
      expect(toUpdateProfileDto({ ...unchanged, avatarMediaId: null }, noAvatar)).toBeNull();
    });
  });
});
