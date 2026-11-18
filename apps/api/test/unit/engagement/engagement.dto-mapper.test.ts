import {
  CommentResponseDto,
  LikeStateResponseDto,
  toPublicId,
  UserSummaryPageResponseDto,
} from "@insta/contracts";
import { describe, expect, it } from "vitest";

import {
  mapCommentPageToResponseDto,
  mapCommentViewToResponseDto,
  mapCreateCommentDtoToCommand,
} from "../../../src/api/mappers/comments.dto-mapper.js";
import { decodeCursor } from "../../../src/api/mappers/shared.dto-mapper.js";
import {
  mapLikerPageToResponseDto,
  mapLikeStateToResponseDto,
} from "../../../src/api/mappers/likes.dto-mapper.js";
import { createUrlBuilder } from "../../../src/api/url-builder.js";
import type { UserRelationView } from "../../../src/domain/identity/views.js";
import type { Username } from "../../../src/domain/identity/user.entity.js";
import type { CommentText } from "../../../src/domain/posts/comment.entity.js";
import type { CommentView } from "../../../src/domain/posts/views.js";
import type { CommentId, PostId, UserId } from "../../../src/domain/shared/ids.js";

const urls = createUrlBuilder("http://api.test/");
const POST = "0190a000-0000-7000-a000-000000000001" as PostId;
const USER = "0190a000-0000-7000-8000-000000000b0b" as UserId;
const COMMENT = "0190a000-0000-7000-b000-000000000001" as CommentId;
const at = new Date("2026-11-17T10:00:00.000Z");
const author = {
  id: USER,
  username: "bob" as Username,
  fullName: "Bob",
  avatarStorageKey: "2026/11/a.jpg",
  viewerIsFollowing: true,
};

describe("likes DTO mappers", () => {
  it("LikeState → LikeStateResponseDto", () => {
    const dto = mapLikeStateToResponseDto({ postId: POST, liked: true, likeCount: 7 });
    expect(LikeStateResponseDto.parse(dto)).toEqual({
      post_id: toPublicId("pst", POST),
      liked: true,
      like_count: 7,
    });
  });

  it("likers page → UserSummaryPageResponseDto with followed_at = like time and an encoded cursor", () => {
    const liker: UserRelationView = { ...author, relationAt: at };
    const dto = mapLikerPageToResponseDto({ items: [liker], nextCursor: { t: at, id: USER } }, urls);
    UserSummaryPageResponseDto.parse(dto);
    expect(dto.items[0]).toEqual({
      id: toPublicId("usr", USER),
      username: "bob",
      full_name: "Bob",
      avatar_url: "http://api.test/media/2026/11/a.jpg",
      is_following: true,
      followed_at: at.toISOString(),
    });
    expect(decodeCursor(dto.next_cursor!)).toEqual({ t: at, id: USER });
  });

  it("empty likers page → next_cursor null", () => {
    expect(mapLikerPageToResponseDto({ items: [], nextCursor: null }, urls)).toEqual({
      items: [],
      next_cursor: null,
    });
  });
});

describe("comments DTO mappers", () => {
  const view: CommentView = { id: COMMENT, postId: POST, author, text: "hi" as CommentText, createdAt: at };

  it("CreateCommentRequestDto → CreateCommentCommand", () => {
    expect(mapCreateCommentDtoToCommand({ text: "hello" }, POST, USER)).toEqual({
      postId: POST,
      authorId: USER,
      text: "hello",
    });
  });

  it("CommentView → CommentResponseDto", () => {
    const dto = mapCommentViewToResponseDto(view, urls);
    expect(CommentResponseDto.parse(dto)).toEqual(dto);
    expect(dto.id).toBe(toPublicId("cmt", COMMENT));
    expect(dto.post_id).toBe(toPublicId("pst", POST));
    expect(dto.author.username).toBe("bob");
    expect(dto.created_at).toBe("2026-11-17T10:00:00.000Z");
  });

  it("comment page keeps order and encodes the cursor", () => {
    const dto = mapCommentPageToResponseDto(
      { items: [view, view], nextCursor: { t: at, id: COMMENT } },
      urls,
    );
    expect(dto.items).toHaveLength(2);
    expect(decodeCursor(dto.next_cursor!)).toEqual({ t: at, id: COMMENT });
  });
});
