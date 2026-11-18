import { describe, expect, it } from "vitest";

import {
  mapUserEntityToRow,
  mapUserProfileViewRow,
  mapUserRowToEntity,
  mapUserSummaryViewRow,
} from "../../../src/data/mappers/users.row-mapper.js";
import type { UserProfileViewRow, UserRow, UserSummaryViewRow } from "../../../src/data/rows/users.row.js";
import type { Email, PasswordHash, User, Username } from "../../../src/domain/identity/user.entity.js";
import type { MediaId, UserId } from "../../../src/domain/shared/ids.js";

const user: User = {
  id: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a01" as UserId,
  username: "alice" as Username,
  email: "alice@example.com" as Email,
  passwordHash: "$argon2id$v=19$hash" as PasswordHash,
  fullName: "Alice Liddell",
  bio: "Down the\nrabbit hole",
  avatarMediaId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a03" as MediaId,
  stats: { posts: 12, followers: 1234, following: 80 },
  createdAt: new Date("2026-11-17T10:00:00.000Z"),
  updatedAt: new Date("2026-11-18T10:00:00.000Z"),
};

describe("users row mapper", () => {
  it("round-trips entity → row → entity", () => {
    expect(mapUserRowToEntity(mapUserEntityToRow(user))).toEqual(user);
  });

  it("round-trips a user without avatar", () => {
    const noAvatar: User = { ...user, avatarMediaId: null, bio: "", fullName: "" };
    expect(mapUserRowToEntity(mapUserEntityToRow(noAvatar))).toEqual(noAvatar);
  });

  it("flattens stats into the *_count columns with snake_case names", () => {
    expect(mapUserEntityToRow(user)).toEqual<UserRow>({
      id: user.id,
      username: "alice",
      email: "alice@example.com",
      password_hash: "$argon2id$v=19$hash",
      full_name: "Alice Liddell",
      bio: "Down the\nrabbit hole",
      avatar_media_id: user.avatarMediaId,
      posts_count: 12,
      followers_count: 1234,
      following_count: 80,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    });
  });

  it("maps a prefixed summary row (author_)", () => {
    const row: UserSummaryViewRow<"author_"> & { caption: string } = {
      author_id: user.id,
      author_username: "alice",
      author_full_name: "Alice Liddell",
      author_avatar_storage_key: "2026/11/x.jpg",
      author_is_following: true,
      caption: "ignored",
    };
    expect(mapUserSummaryViewRow(row, "author_")).toEqual({
      id: user.id,
      username: "alice",
      fullName: "Alice Liddell",
      avatarStorageKey: "2026/11/x.jpg",
      viewerIsFollowing: true,
    });
  });

  it("maps an unprefixed summary row with NULL avatar / follow flag", () => {
    const row: UserSummaryViewRow = {
      id: user.id,
      username: "alice",
      full_name: "",
      avatar_storage_key: null,
      is_following: null,
    };
    expect(mapUserSummaryViewRow(row, "")).toMatchObject({ avatarStorageKey: null, viewerIsFollowing: null });
  });

  describe("mapUserProfileViewRow", () => {
    const row: UserProfileViewRow = {
      id: user.id,
      username: "alice",
      full_name: "Alice Liddell",
      avatar_storage_key: null,
      is_following: false,
      bio: "bio",
      posts_count: 1,
      followers_count: 2,
      following_count: 3,
      has_active_story: true,
      created_at: user.createdAt,
      email: null,
    };

    it("maps counters into stats and omits email for other users", () => {
      const view = mapUserProfileViewRow(row);
      expect(view).toEqual({
        id: user.id,
        username: "alice",
        fullName: "Alice Liddell",
        avatarStorageKey: null,
        viewerIsFollowing: false,
        bio: "bio",
        stats: { posts: 1, followers: 2, following: 3 },
        hasActiveStory: true,
        createdAt: user.createdAt,
      });
      expect(view).not.toHaveProperty("email");
    });

    it("includes email when the query selected it (own profile)", () => {
      expect(mapUserProfileViewRow({ ...row, email: "alice@example.com", is_following: null }).email).toBe(
        "alice@example.com",
      );
    });
  });
});
