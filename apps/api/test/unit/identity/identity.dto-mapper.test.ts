import {
  AuthTokenResponseDto,
  MeResponseDto,
  UpdateProfileRequestDto,
  UserProfileResponseDto,
  UserSummaryDto,
} from "@insta/contracts";
import { describe, expect, it } from "vitest";

import {
  mapLoginDtoToCommand,
  mapSessionToAuthTokenDto,
  mapSignupDtoToCommand,
  mapUpdateProfileDtoToCommand,
  mapUserProfileViewToResponseDto,
  mapUserToMeResponseDto,
  mapUserToSummaryDto,
} from "../../../src/api/mappers/identity.dto-mapper.js";
import { createUrlBuilder } from "../../../src/api/url-builder.js";
import type { Session } from "../../../src/domain/identity/session.entity.js";
import type { Email, Username } from "../../../src/domain/identity/user.entity.js";
import type { UserProfileView } from "../../../src/domain/identity/views.js";
import type { SessionId, UserId } from "../../../src/domain/shared/ids.js";

const urls = createUrlBuilder("http://api.test/");
const USER_ID = "0190a000-0000-7000-8000-00000000000a" as UserId;

const view: UserProfileView = {
  id: USER_ID,
  username: "alice" as Username,
  fullName: "Alice",
  avatarStorageKey: "2026/11/abc.png",
  viewerIsFollowing: null,
  bio: "hello",
  stats: { posts: 3, followers: 2, following: 1 },
  hasActiveStory: true,
  createdAt: new Date("2026-11-17T10:00:00.000Z"),
  email: "alice@example.com" as Email,
};

describe("identity DTO mappers", () => {
  it("mapSignupDtoToCommand / mapLoginDtoToCommand", () => {
    expect(
      mapSignupDtoToCommand(
        { username: "alice", email: "a@b.co", password: "12345678", full_name: "" },
        "ua",
      ),
    ).toEqual({ username: "alice", email: "a@b.co", password: "12345678", fullName: "", userAgent: "ua" });
    expect(mapLoginDtoToCommand({ login: "alice", password: "p" }, "ua")).toEqual({
      login: "alice",
      password: "p",
      userAgent: "ua",
    });
  });

  describe("mapUpdateProfileDtoToCommand", () => {
    it("maps present fields only and parses the avatar public id", () => {
      const dto = UpdateProfileRequestDto.parse({
        full_name: "A",
        avatar_media_id: "med_0190a0000000700080000000000000ff",
      });
      expect(mapUpdateProfileDtoToCommand(dto, USER_ID)).toEqual({
        userId: USER_ID,
        fullName: "A",
        avatarMediaId: "0190a000-0000-7000-8000-0000000000ff",
      });
    });

    it("keeps avatar null (remove) and omits absent avatar", () => {
      expect(mapUpdateProfileDtoToCommand({ avatar_media_id: null }, USER_ID)).toEqual({
        userId: USER_ID,
        avatarMediaId: null,
      });
      const cmd = mapUpdateProfileDtoToCommand({ bio: "" }, USER_ID);
      expect(cmd).toEqual({ userId: USER_ID, bio: "" });
      expect("avatarMediaId" in cmd).toBe(false);
    });

    it("malformed avatar id → VALIDATION_FAILED on avatar_media_id", () => {
      expect(() => mapUpdateProfileDtoToCommand({ avatar_media_id: "usr_123" }, USER_ID)).toThrow(
        expect.objectContaining({
          code: "VALIDATION_FAILED",
          details: [expect.objectContaining({ path: "avatar_media_id" })],
        }),
      );
    });

    it("schema rejects empty and unknown-field bodies", () => {
      expect(UpdateProfileRequestDto.safeParse({}).success).toBe(false);
      expect(UpdateProfileRequestDto.safeParse({ email: "x@y.z" }).success).toBe(false);
    });
  });

  it("mapUserToSummaryDto builds public id and avatar URL", () => {
    const dto = mapUserToSummaryDto({ ...view, avatarStorageKey: null, viewerIsFollowing: false }, urls);
    expect(dto).toEqual({
      id: "usr_0190a00000007000800000000000000a",
      username: "alice",
      full_name: "Alice",
      avatar_url: null,
      is_following: false,
    });
    expect(UserSummaryDto.parse(dto)).toEqual(dto);
  });

  it("mapUserProfileViewToResponseDto never leaks email and parses with the contract", () => {
    const dto = mapUserProfileViewToResponseDto(view, urls);
    expect(dto).not.toHaveProperty("email");
    expect(dto.avatar_url).toBe("http://api.test/media/2026/11/abc.png");
    expect(dto).toMatchObject({
      posts_count: 3,
      followers_count: 2,
      following_count: 1,
      has_active_story: true,
    });
    expect(dto.created_at).toBe("2026-11-17T10:00:00.000Z");
    expect(UserProfileResponseDto.strict().parse(dto)).toEqual(dto);
  });

  it("mapUserToMeResponseDto requires the email", () => {
    const dto = mapUserToMeResponseDto(view, urls);
    expect(MeResponseDto.strict().parse(dto).email).toBe("alice@example.com");
    const { email: _omit, ...noEmail } = view;
    expect(() => mapUserToMeResponseDto(noEmail, urls)).toThrow(
      expect.objectContaining({ code: "INTERNAL" }),
    );
  });

  it("mapSessionToAuthTokenDto", () => {
    const session: Session = {
      id: "0190a000-0000-7000-8000-0000000000bb" as SessionId,
      userId: USER_ID,
      tokenHash: Buffer.alloc(32),
      userAgent: "",
      createdAt: new Date("2026-11-17T10:00:00.000Z"),
      expiresAt: new Date("2026-12-17T10:00:00.000Z"),
      revokedAt: null,
    };
    const dto = mapSessionToAuthTokenDto({ session, rawToken: "t".repeat(43) }, view, urls);
    expect(AuthTokenResponseDto.parse(dto)).toEqual(dto);
    expect(dto).toMatchObject({
      access_token: "t".repeat(43),
      token_type: "Bearer",
      expires_at: "2026-12-17T10:00:00.000Z",
    });
    expect(JSON.stringify(dto)).not.toContain("token_hash");
  });
});
