import { describe, expect, it } from "vitest";

import {
  mapCommentEntityToRow,
  mapCommentRowToEntity,
  mapCommentViewRow,
} from "../../../src/data/mappers/comments.row-mapper.js";
import type { CommentRow, CommentViewRow } from "../../../src/data/rows/comments.row.js";
import type { Comment, CommentText } from "../../../src/domain/posts/comment.entity.js";
import type { CommentId, PostId, UserId } from "../../../src/domain/shared/ids.js";

const live: Comment = {
  id: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a30" as CommentId,
  postId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a20" as PostId,
  authorId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a02" as UserId,
  text: "Nice!" as CommentText,
  createdAt: new Date("2026-11-18T10:00:00.000Z"),
  deletedAt: null,
};
const deleted: Comment = { ...live, deletedAt: new Date("2026-11-18T11:00:00.000Z") };

describe("comments row mapper", () => {
  it.each([
    ["live", live],
    ["deleted", deleted],
  ])("round-trips a %s comment entity → row → entity", (_label, c) => {
    expect(mapCommentRowToEntity(mapCommentEntityToRow(c))).toEqual(c);
  });

  it("maps to snake_case columns", () => {
    expect(mapCommentEntityToRow(deleted)).toEqual<CommentRow>({
      id: deleted.id,
      post_id: deleted.postId,
      author_id: deleted.authorId,
      text: "Nice!",
      created_at: deleted.createdAt,
      deleted_at: deleted.deletedAt,
    });
  });

  it("maps a view row with author_* columns to CommentView", () => {
    const row: CommentViewRow = {
      ...mapCommentEntityToRow(live),
      author_id: live.authorId,
      author_username: "bob",
      author_full_name: "Bob B",
      author_avatar_storage_key: "2026/11/avatar.jpg",
      author_is_following: null,
    };
    expect(mapCommentViewRow(row)).toEqual({
      id: live.id,
      postId: live.postId,
      author: {
        id: live.authorId,
        username: "bob",
        fullName: "Bob B",
        avatarStorageKey: "2026/11/avatar.jpg",
        viewerIsFollowing: null,
      },
      text: "Nice!",
      createdAt: live.createdAt,
    });
  });
});
