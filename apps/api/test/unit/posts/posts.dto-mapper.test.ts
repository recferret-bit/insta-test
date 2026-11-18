import { CreatePostRequestDto, PostPageResponseDto, PostResponseDto } from "@insta/contracts";
import { describe, expect, it } from "vitest";

import {
  mapCreatePostDtoToCommand,
  mapPostPageToResponseDto,
  mapPostViewToResponseDto,
  mapUpdatePostDtoToCommand,
} from "../../../src/api/mappers/posts.dto-mapper.js";
import { decodeCursor } from "../../../src/api/mappers/shared.dto-mapper.js";
import { createUrlBuilder } from "../../../src/api/url-builder.js";
import type { Username } from "../../../src/domain/identity/user.entity.js";
import type { Caption, Hashtag } from "../../../src/domain/posts/post.entity.js";
import type { PostView } from "../../../src/domain/posts/views.js";
import type { MediaId, PostId, UserId } from "../../../src/domain/shared/ids.js";
import { sampleMedia } from "./fakes.js";

const AUTHOR = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as UserId;
const POST = "0190a1b2-c3d4-7e5f-8a9b-bbbbbbbbbbbb" as PostId;
const M1 = "0190a1b2-c3d4-7e5f-8a9b-000000000001" as MediaId;
const M2 = "0190a1b2-c3d4-7e5f-8a9b-000000000002" as MediaId;
const urls = createUrlBuilder("https://api.example.com");

const view: PostView = {
  id: POST,
  author: {
    id: AUTHOR,
    username: "alice" as Username,
    fullName: "Alice",
    avatarStorageKey: "2026/11/avatar.jpg",
    viewerIsFollowing: true,
  },
  caption: "Hi #Sun" as Caption,
  media: [sampleMedia(M2, AUTHOR, { status: "attached" }), sampleMedia(M1, AUTHOR, { status: "attached" })],
  hashtags: ["sun"] as Hashtag[],
  likeCount: 3,
  commentCount: 1,
  viewerHasLiked: true,
  createdAt: new Date("2026-11-17T10:00:00.000Z"),
  updatedAt: new Date("2026-11-17T11:00:00.000Z"),
};

describe("posts DTO mappers (F-ECOMM-05)", () => {
  it("mapCreatePostDtoToCommand parses med_ IDs in order and keeps the caption", () => {
    const dto = CreatePostRequestDto.parse({
      media_ids: ["med_0190a1b2c3d47e5f8a9b000000000002", "med_0190a1b2c3d47e5f8a9b000000000001"],
    });
    expect(mapCreatePostDtoToCommand(dto, AUTHOR)).toEqual({
      authorId: AUTHOR,
      caption: "",
      mediaIds: [M2, M1],
    });
  });

  it("mapCreatePostDtoToCommand → VALIDATION_FAILED with the offending index for a bad ID", () => {
    const dto = { caption: "", media_ids: ["med_0190a1b2c3d47e5f8a9b000000000001", "pst_nope"] };
    expect(() => mapCreatePostDtoToCommand(dto, AUTHOR)).toThrow(
      expect.objectContaining({
        code: "VALIDATION_FAILED",
        details: [expect.objectContaining({ path: "media_ids.1" })],
      }),
    );
  });

  it("mapUpdatePostDtoToCommand", () => {
    expect(mapUpdatePostDtoToCommand({ caption: "new" }, POST, AUTHOR)).toEqual({
      postId: POST,
      actorId: AUTHOR,
      caption: "new",
    });
  });

  it("mapPostViewToResponseDto produces a contract-valid DTO with public IDs and URLs", () => {
    const dto = mapPostViewToResponseDto(view, urls);
    expect(PostResponseDto.parse(dto)).toEqual(dto);
    expect(dto).toMatchObject({
      id: "pst_0190a1b2c3d47e5f8a9bbbbbbbbbbbbb",
      author: {
        id: "usr_0190a1b2c3d47e5f8a9b0c1d2e3f4a5b",
        username: "alice",
        full_name: "Alice",
        avatar_url: "https://api.example.com/media/2026/11/avatar.jpg",
        is_following: true,
      },
      caption: "Hi #Sun",
      hashtags: ["sun"],
      like_count: 3,
      comment_count: 1,
      viewer_has_liked: true,
      created_at: "2026-11-17T10:00:00.000Z",
      updated_at: "2026-11-17T11:00:00.000Z",
    });
    expect(dto.media.map((m) => m.id)).toEqual([
      "med_0190a1b2c3d47e5f8a9b000000000002",
      "med_0190a1b2c3d47e5f8a9b000000000001",
    ]);
    expect(dto.media[0]!.url).toBe(`https://api.example.com/media/2026/11/${M2}.jpg`);
  });

  it("mapPostPageToResponseDto encodes next_cursor (or null)", () => {
    const cursor = { t: new Date("2026-11-17T10:00:00.000Z"), id: POST };
    const dto = mapPostPageToResponseDto({ items: [view], nextCursor: cursor }, urls);
    expect(PostPageResponseDto.parse(dto)).toEqual(dto);
    expect(decodeCursor(dto.next_cursor!)).toEqual(cursor);
    expect(mapPostPageToResponseDto({ items: [], nextCursor: null }, urls)).toEqual({
      items: [],
      next_cursor: null,
    });
  });
});
