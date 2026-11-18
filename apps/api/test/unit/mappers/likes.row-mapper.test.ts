import { describe, expect, it } from "vitest";

import {
  mapLikeEntityToRow,
  mapPostLikeRowToEntity,
  mapPostLikerViewRow,
} from "../../../src/data/mappers/likes.row-mapper.js";
import type { PostLikeRow, PostLikerViewRow } from "../../../src/data/rows/likes.row.js";
import { Like } from "../../../src/domain/posts/like.entity.js";
import type { PostId, UserId } from "../../../src/domain/shared/ids.js";

const like: Like = Like.create({
  postId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a20" as PostId,
  userId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a02" as UserId,
  now: new Date("2026-11-18T10:00:00.000Z"),
});

describe("likes row mapper", () => {
  it("Like.create builds the entity", () => {
    expect(like).toEqual({ postId: like.postId, userId: like.userId, createdAt: like.createdAt });
  });

  it("round-trips entity → row → entity", () => {
    expect(mapPostLikeRowToEntity(mapLikeEntityToRow(like))).toEqual(like);
  });

  it("maps to snake_case columns", () => {
    expect(mapLikeEntityToRow(like)).toEqual<PostLikeRow>({
      post_id: like.postId,
      user_id: like.userId,
      created_at: like.createdAt,
    });
  });

  it("maps a likers row to UserRelationView", () => {
    const row: PostLikerViewRow = {
      id: like.userId,
      username: "bob",
      full_name: "Bob",
      avatar_storage_key: null,
      is_following: false,
      liked_at: like.createdAt,
    };
    expect(mapPostLikerViewRow(row)).toEqual({
      id: like.userId,
      username: "bob",
      fullName: "Bob",
      avatarStorageKey: null,
      viewerIsFollowing: false,
      relationAt: like.createdAt,
    });
  });
});
