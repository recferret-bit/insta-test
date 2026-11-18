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

describe("user mappers — W01-01 coverage (compact counts, initials fallback)", () => {
  const svgOf = (dataUrl: string) => decodeURIComponent(dataUrl.slice(dataUrl.indexOf(",") + 1));

  it("initials avatar uses up to two full-name initials, else the username initial", () => {
    const withName = toUserSummaryVM(userSummary({ full_name: "alice pleasance liddell", avatar_url: null }));
    expect(svgOf(withName.avatarUrl)).toContain(">AP</text>");
    const noName = toUserSummaryVM(userSummary({ full_name: "   ", avatar_url: null }));
    expect(noName.displayName).toBe("alice");
    expect(svgOf(noName.avatarUrl)).toContain(">A</text>");
  });

  it("initials avatar is deterministic per user and escapes markup", () => {
    const a = toUserSummaryVM(userSummary({ avatar_url: null }));
    const b = toUserSummaryVM(userSummary({ avatar_url: null }));
    expect(a.avatarUrl).toBe(b.avatarUrl);
    const odd = toUserSummaryVM(userSummary({ full_name: "<b> &", avatar_url: null }));
    expect(svgOf(odd.avatarUrl)).not.toContain("<b>");
  });

  it("profile and me fall back to the initials avatar too", () => {
    const vm = toProfileVM(profile({ avatar_url: null }), null);
    expect(vm.hasCustomAvatar).toBe(false);
    expect(vm.avatarUrl.startsWith("data:image/svg+xml")).toBe(true);
    expect(toMeVM(me({ avatar_url: null })).hasCustomAvatar).toBe(false);
  });

  it.each([
    [0, 0, 0, { posts: "0", followers: "0", following: "0" }, "0 posts, 0 followers, 0 following"],
    [1, 1, 1, { posts: "1", followers: "1", following: "1" }, "1 post, 1 follower, 1 following"],
    [
      999,
      1000,
      1_500_000,
      { posts: "999", followers: "1K", following: "1.5M" },
      "999 posts, 1K followers, 1.5M following",
    ],
    [
      12_345,
      2_000_000_000,
      10_050,
      { posts: "12.3K", followers: "2B", following: "10.1K" },
      "12.3K posts, 2B followers, 10.1K following",
    ],
  ])("compact counters for %i/%i/%i", (posts, followers, following, label, summary) => {
    const vm = toProfileVM(
      profile({ posts_count: posts, followers_count: followers, following_count: following }),
      null,
    );
    expect(vm.countsLabel).toEqual(label);
    expect(vm.countsSummary).toBe(summary);
    expect(vm).toMatchObject({ postsCount: posts, followersCount: followers, followingCount: following });
  });

  it("maps every profile field and URL-encodes the profile path", () => {
    const vm = toProfileVM(profile({ is_following: false, has_active_story: false }), hexId("usr", 2));
    expect(vm).toMatchObject({
      id: hexId("usr", 1),
      username: "alice",
      fullName: "Alice Liddell",
      displayName: "Alice Liddell",
      bio: "Down the rabbit hole",
      avatarUrl: "http://api.test/media/2026/11/a.jpg",
      hasCustomAvatar: true,
      isFollowing: false,
      hasActiveStory: false,
      isSelf: false,
      profilePath: "/u/alice",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(toUserSummaryVM(userSummary({ username: "a.b_c" })).profilePath).toBe("/u/a.b_c");
  });
});
