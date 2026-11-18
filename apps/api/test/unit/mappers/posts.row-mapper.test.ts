import { describe, expect, it } from "vitest";

import { mapMediaEntityToRow } from "../../../src/data/mappers/media.row-mapper.js";
import {
  mapPostEntityToRows,
  mapPostRowsToEntity,
  mapPostViewRows,
} from "../../../src/data/mappers/posts.row-mapper.js";
import type { PostMediaViewRow, PostViewRow } from "../../../src/data/rows/posts.row.js";
import type { MediaAsset } from "../../../src/domain/media/media-asset.entity.js";
import { Post } from "../../../src/domain/posts/post.entity.js";
import type { MediaId, PostId, UserId } from "../../../src/domain/shared/ids.js";

const authorId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a01" as UserId;
const postId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a20" as PostId;
const mediaId = (n: number) => `0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4b0${n}` as MediaId;
const now = new Date("2026-11-18T10:00:00.000Z");

const created = Post.create({
  id: postId,
  authorId,
  caption: "Sunset at the #Beach #sun #beach #Golden_Hour",
  mediaIds: [mediaId(2), mediaId(0), mediaId(1)],
  now,
});
const deleted: Post = {
  ...created,
  likeCount: 7,
  commentCount: 3,
  updatedAt: new Date("2026-11-18T11:00:00.000Z"),
  deletedAt: new Date("2026-11-18T12:00:00.000Z"),
};
const noTags = Post.create({ id: postId, authorId, caption: "", mediaIds: [mediaId(0)], now });

describe("posts row mapper", () => {
  it.each([
    ["created", created],
    ["edited & deleted", deleted],
    ["single media, no tags", noTags],
  ])("round-trips a %s post entity → rows → entity", (_label, post) => {
    const rows = mapPostEntityToRows(post);
    expect(mapPostRowsToEntity(rows.post, rows.media, rows.hashtags)).toEqual(post);
  });

  it("flattens the aggregate into posts / post_media / post_hashtags rows", () => {
    expect(mapPostEntityToRows(deleted)).toEqual({
      post: {
        id: postId,
        author_id: authorId,
        caption: deleted.caption,
        like_count: 7,
        comment_count: 3,
        created_at: deleted.createdAt,
        updated_at: deleted.updatedAt,
        deleted_at: deleted.deletedAt,
      },
      media: [
        { post_id: postId, media_id: mediaId(2), position: 0 },
        { post_id: postId, media_id: mediaId(0), position: 1 },
        { post_id: postId, media_id: mediaId(1), position: 2 },
      ],
      hashtags: [
        { post_id: postId, tag: "beach", position: 0 },
        { post_id: postId, tag: "sun", position: 1 },
        { post_id: postId, tag: "golden_hour", position: 2 },
      ],
    });
  });

  it("sorts media and hashtags by position regardless of query order, without mutating inputs", () => {
    const rows = mapPostEntityToRows(created);
    const media = [...rows.media].reverse();
    const tags = [rows.hashtags[2]!, rows.hashtags[0]!, rows.hashtags[1]!];
    const entity = mapPostRowsToEntity(rows.post, media, tags);
    expect(entity.media.map((m) => m.mediaId)).toEqual([mediaId(2), mediaId(0), mediaId(1)]);
    expect(entity.hashtags).toEqual(["beach", "sun", "golden_hour"]);
    expect(media[0]!.position).toBe(2);
  });

  describe("mapPostViewRows", () => {
    const asset = (n: number): MediaAsset => ({
      id: mediaId(n),
      ownerId: authorId,
      purpose: "post",
      kind: n === 1 ? "video" : "image",
      mimeType: n === 1 ? "video/mp4" : "image/jpeg",
      storageKey: `2026/11/${mediaId(n)}.${n === 1 ? "mp4" : "jpg"}`,
      byteSize: 1000 + n,
      width: n === 1 ? null : 1080,
      height: n === 1 ? null : 1350,
      durationMs: n === 1 ? 5000 : null,
      status: "attached",
      createdAt: now,
    });
    const rows = mapPostEntityToRows(deleted);
    const postRow: PostViewRow = {
      ...rows.post,
      author_id: authorId,
      author_username: "alice",
      author_full_name: "Alice",
      author_avatar_storage_key: null,
      author_is_following: null,
    };
    const mediaRows: PostMediaViewRow[] = rows.media
      .map((m) => ({
        ...mapMediaEntityToRow(asset(Number(m.media_id.at(-1)))),
        post_id: postId,
        position: m.position,
      }))
      .reverse();

    it("assembles PostView with ordered media assets, hashtags and viewer flag", () => {
      const view = mapPostViewRows(postRow, postRow, mediaRows, [...rows.hashtags].reverse(), true);
      expect(view).toEqual({
        id: postId,
        author: {
          id: authorId,
          username: "alice",
          fullName: "Alice",
          avatarStorageKey: null,
          viewerIsFollowing: null,
        },
        caption: deleted.caption,
        media: [asset(2), asset(0), asset(1)],
        hashtags: ["beach", "sun", "golden_hour"],
        likeCount: 7,
        commentCount: 3,
        viewerHasLiked: true,
        createdAt: deleted.createdAt,
        updatedAt: deleted.updatedAt,
      });
    });

    it("passes viewerHasLiked=false through (anonymous)", () => {
      expect(mapPostViewRows(postRow, postRow, mediaRows, [], false)).toMatchObject({
        viewerHasLiked: false,
        hashtags: [],
      });
    });
  });
});
