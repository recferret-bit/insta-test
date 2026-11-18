import { FollowListItemDto, FollowStateResponseDto } from "@insta/contracts";
import { describe, expect, it } from "vitest";

import {
  mapFollowStateToResponseDto,
  mapUserSummaryViewToFollowListItemDto,
} from "../../../src/api/mappers/social.dto-mapper.js";
import { createUrlBuilder } from "../../../src/api/url-builder.js";
import type { Username } from "../../../src/domain/identity/user.entity.js";
import type { UserRelationView } from "../../../src/domain/identity/views.js";
import type { UserId } from "../../../src/domain/shared/ids.js";
import { FollowState } from "../../../src/domain/social/follow.entity.js";

const urls = createUrlBuilder("http://api.test/");
const USER_ID = "0190a000-0000-7000-8000-00000000000b" as UserId;

describe("mapFollowStateToResponseDto", () => {
  it("maps the followee id to a public usr_ id", () => {
    const dto = mapFollowStateToResponseDto(FollowState.of(USER_ID, true, 7));
    expect(dto).toEqual({
      user_id: "usr_0190a00000007000800000000000000b",
      following: true,
      followers_count: 7,
    });
    expect(FollowStateResponseDto.parse(dto)).toEqual(dto);
  });

  it("maps the unfollowed state with zero followers", () => {
    const dto = mapFollowStateToResponseDto(FollowState.of(USER_ID, false, 0));
    expect(dto).toMatchObject({ following: false, followers_count: 0 });
  });
});

describe("mapUserSummaryViewToFollowListItemDto", () => {
  const base: UserRelationView = {
    id: USER_ID,
    username: "bob" as Username,
    fullName: "Bob",
    avatarStorageKey: "2026/11/b.png",
    viewerIsFollowing: true,
    relationAt: new Date("2026-11-18T12:00:00.123Z"),
  };

  it("adds followed_at and builds the avatar URL", () => {
    const dto = mapUserSummaryViewToFollowListItemDto(base, urls);
    expect(dto).toEqual({
      id: "usr_0190a00000007000800000000000000b",
      username: "bob",
      full_name: "Bob",
      avatar_url: "http://api.test/media/2026/11/b.png",
      is_following: true,
      followed_at: "2026-11-18T12:00:00.123Z",
    });
    expect(FollowListItemDto.parse(dto)).toEqual(dto);
  });

  it("keeps null avatar and null is_following (anonymous / self)", () => {
    const dto = mapUserSummaryViewToFollowListItemDto(
      { ...base, avatarStorageKey: null, viewerIsFollowing: null },
      urls,
    );
    expect(dto).toMatchObject({ avatar_url: null, is_following: null });
  });
});
