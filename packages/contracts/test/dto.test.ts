import { describe, expect, it } from "vitest";

import {
  CreateCommentRequestDto,
  CreatePostRequestDto,
  HashtagSearchQueryDto,
  LoginRequestDto,
  MarkNotificationsReadRequestDto,
  PageQuery,
  PostResponseDto,
  SignupRequestDto,
  UpdatePostRequestDto,
  UpdateProfileRequestDto,
  UploadMediaFields,
  UserSearchQueryDto,
} from "../src/index.js";

const MED = (n: number) => `med_${n.toString(16).padStart(32, "0")}`;

describe("SignupRequestDto", () => {
  const valid = { username: "  Alice.B_1 ", email: "Alice@Example.COM", password: "password1" };

  it("normalises username/email and defaults full_name", () => {
    expect(SignupRequestDto.parse(valid)).toEqual({
      username: "alice.b_1",
      email: "alice@example.com",
      password: "password1",
      full_name: "",
    });
  });

  it.each([
    ["username too short", { username: "ab" }],
    ["username too long", { username: "a".repeat(31) }],
    ["username leading dot", { username: ".alice" }],
    ["username trailing dot", { username: "alice." }],
    ["username bad char", { username: "ali-ce" }],
    ["bad email", { email: "nope" }],
    ["password too short", { password: "1234567" }],
    ["password too long", { password: "x".repeat(129) }],
    ["full_name too long", { full_name: "x".repeat(61) }],
  ])("rejects %s", (_label, patch) => {
    expect(SignupRequestDto.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it("accepts boundary lengths", () => {
    expect(
      SignupRequestDto.safeParse({
        ...valid,
        username: "a".repeat(30),
        password: "x".repeat(128),
        full_name: "y".repeat(60),
      }).success,
    ).toBe(true);
  });

  it("is strict (unknown keys rejected)", () => {
    expect(SignupRequestDto.safeParse({ ...valid, admin: true }).success).toBe(false);
  });
});

describe("LoginRequestDto", () => {
  it("requires both fields", () => {
    expect(LoginRequestDto.safeParse({ login: "alice", password: "x" }).success).toBe(true);
    expect(LoginRequestDto.safeParse({ login: "", password: "x" }).success).toBe(false);
    expect(LoginRequestDto.safeParse({ login: "alice" }).success).toBe(false);
  });
});

describe("UpdateProfileRequestDto", () => {
  it("requires at least one field", () => {
    expect(UpdateProfileRequestDto.safeParse({}).success).toBe(false);
  });

  it("accepts null avatar to remove it", () => {
    expect(UpdateProfileRequestDto.parse({ avatar_media_id: null })).toEqual({ avatar_media_id: null });
  });

  it("limits bio to 150 chars and 4 newlines", () => {
    expect(UpdateProfileRequestDto.safeParse({ bio: "x".repeat(150) }).success).toBe(true);
    expect(UpdateProfileRequestDto.safeParse({ bio: "x".repeat(151) }).success).toBe(false);
    expect(UpdateProfileRequestDto.safeParse({ bio: "a\nb\nc\nd\ne" }).success).toBe(true);
    expect(UpdateProfileRequestDto.safeParse({ bio: "a\nb\nc\nd\ne\nf" }).success).toBe(false);
  });

  it("rejects unknown fields and wrong id prefix", () => {
    expect(UpdateProfileRequestDto.safeParse({ email: "a@b.co" }).success).toBe(false);
    expect(UpdateProfileRequestDto.safeParse({ avatar_media_id: "usr_" + "0".repeat(32) }).success).toBe(
      false,
    );
  });
});

describe("CreatePostRequestDto", () => {
  it("defaults caption and accepts 1..10 unique media", () => {
    expect(CreatePostRequestDto.parse({ media_ids: [MED(1)] })).toEqual({ caption: "", media_ids: [MED(1)] });
    const ten = Array.from({ length: 10 }, (_, i) => MED(i + 1));
    expect(CreatePostRequestDto.safeParse({ media_ids: ten }).success).toBe(true);
  });

  it("rejects 0, 11 or duplicate media and a too-long caption", () => {
    expect(CreatePostRequestDto.safeParse({ media_ids: [] }).success).toBe(false);
    const eleven = Array.from({ length: 11 }, (_, i) => MED(i + 1));
    expect(CreatePostRequestDto.safeParse({ media_ids: eleven }).success).toBe(false);
    expect(CreatePostRequestDto.safeParse({ media_ids: [MED(1), MED(1)] }).success).toBe(false);
    expect(CreatePostRequestDto.safeParse({ media_ids: [MED(1)], caption: "x".repeat(2201) }).success).toBe(
      false,
    );
  });

  it("UpdatePostRequestDto accepts 2200 and rejects 2201 chars", () => {
    expect(UpdatePostRequestDto.safeParse({ caption: "x".repeat(2200) }).success).toBe(true);
    expect(UpdatePostRequestDto.safeParse({ caption: "x".repeat(2201) }).success).toBe(false);
  });
});

describe("CreateCommentRequestDto", () => {
  it("trims and bounds text to 1..500", () => {
    expect(CreateCommentRequestDto.parse({ text: "  hi  " })).toEqual({ text: "hi" });
    expect(CreateCommentRequestDto.safeParse({ text: "   " }).success).toBe(false);
    expect(CreateCommentRequestDto.safeParse({ text: "x".repeat(500) }).success).toBe(true);
    expect(CreateCommentRequestDto.safeParse({ text: "x".repeat(501) }).success).toBe(false);
  });
});

describe("query schemas", () => {
  it("PageQuery coerces limit and defaults to 20", () => {
    expect(PageQuery.parse({})).toEqual({ limit: 20 });
    expect(PageQuery.parse({ limit: "50", cursor: "abc" })).toEqual({ limit: 50, cursor: "abc" });
    expect(PageQuery.safeParse({ limit: "0" }).success).toBe(false);
    expect(PageQuery.safeParse({ limit: "51" }).success).toBe(false);
    expect(PageQuery.safeParse({ offset: "5" }).success).toBe(false);
  });

  it("search queries bound q and limit", () => {
    expect(UserSearchQueryDto.safeParse({ q: "x".repeat(50) }).success).toBe(true);
    expect(UserSearchQueryDto.safeParse({ q: "x".repeat(51) }).success).toBe(false);
    expect(UserSearchQueryDto.safeParse({ q: "" }).success).toBe(false);
    expect(HashtagSearchQueryDto.safeParse({ q: "x".repeat(64), limit: "30" }).success).toBe(true);
    expect(HashtagSearchQueryDto.safeParse({ q: "x", limit: "31" }).success).toBe(false);
  });

  it("UploadMediaFields coerces numeric multipart text", () => {
    expect(UploadMediaFields.parse({ purpose: "story", duration_ms: "60000", width: "8192" })).toEqual({
      purpose: "story",
      duration_ms: 60000,
      width: 8192,
    });
    expect(UploadMediaFields.safeParse({ purpose: "story", duration_ms: "60001" }).success).toBe(false);
    expect(UploadMediaFields.safeParse({ purpose: "banner" }).success).toBe(false);
  });

  it("MarkNotificationsReadRequestDto requires an ntf_ id", () => {
    expect(MarkNotificationsReadRequestDto.safeParse({ up_to_id: "ntf_" + "a".repeat(32) }).success).toBe(
      true,
    );
    expect(MarkNotificationsReadRequestDto.safeParse({ up_to_id: "pst_" + "a".repeat(32) }).success).toBe(
      false,
    );
  });
});

describe("response schemas", () => {
  const author = {
    id: "usr_" + "1".repeat(32),
    username: "alice",
    full_name: "Alice",
    avatar_url: null,
    is_following: null,
  };
  const post = {
    id: "pst_" + "2".repeat(32),
    author,
    caption: "hi #sun",
    media: [
      {
        id: MED(3),
        kind: "image",
        purpose: "post",
        mime_type: "image/jpeg",
        url: "http://localhost:18001/media/2026/11/x.jpg",
        width: 10,
        height: 10,
        duration_ms: null,
        size_bytes: 100,
        created_at: "2026-11-17T10:00:00.000Z",
      },
    ],
    hashtags: ["sun"],
    like_count: 0,
    comment_count: 0,
    viewer_has_liked: false,
    created_at: "2026-11-17T10:00:00.000Z",
    updated_at: "2026-11-17T10:00:00.000Z",
  };

  it("parses a valid post and tolerates additive fields", () => {
    expect(PostResponseDto.safeParse(post).success).toBe(true);
    expect(PostResponseDto.safeParse({ ...post, future_field: 1 }).success).toBe(true);
  });

  it("rejects non-UTC or millisecond-less timestamps", () => {
    expect(PostResponseDto.safeParse({ ...post, created_at: "2026-11-17T10:00:00Z" }).success).toBe(false);
    expect(PostResponseDto.safeParse({ ...post, created_at: "2026-11-17T10:00:00.000+01:00" }).success).toBe(
      false,
    );
  });
});
