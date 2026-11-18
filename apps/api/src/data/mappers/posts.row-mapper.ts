import type { Caption, Hashtag, Post } from "../../domain/posts/post.entity.js";
import type { PostView } from "../../domain/posts/views.js";
import type { MediaId, PostId, UserId } from "../../domain/shared/ids.js";
import type { UserSummaryViewRow } from "../rows/users.row.js";
import type { PostHashtagRow, PostMediaRow, PostMediaViewRow, PostRow } from "../rows/posts.row.js";
import { mapMediaRowToEntity } from "./media.row-mapper.js";
import { mapUserSummaryViewRow } from "./users.row-mapper.js";

/** The three tables of the `ENT-Post` aggregate. */
export type PostRows = { post: PostRow; media: PostMediaRow[]; hashtags: PostHashtagRow[] };

const byPosition = <T extends { position: number }>(a: T, b: T): number => a.position - b.position;

/**
 * `ENT-Post` Rows → Business Entity (persistence/03-row-mappers.md#mapper-catalog). `media` and `tags` must
 * belong to `post`; both are sorted by `position` (input arrays are not mutated).
 */
export function mapPostRowsToEntity(post: PostRow, media: PostMediaRow[], tags: PostHashtagRow[]): Post {
  return {
    id: post.id as PostId,
    authorId: post.author_id as UserId,
    caption: post.caption as Caption,
    media: [...media].sort(byPosition).map((m) => ({ mediaId: m.media_id as MediaId, position: m.position })),
    hashtags: [...tags].sort(byPosition).map((t) => t.tag as Hashtag),
    likeCount: post.like_count,
    commentCount: post.comment_count,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    deletedAt: post.deleted_at,
  };
}

/** `ENT-Post` Business Entity → Rows; hashtag `position` = index in `post.hashtags` (first-appearance order). */
export function mapPostEntityToRows(post: Post): PostRows {
  return {
    post: {
      id: post.id,
      author_id: post.authorId,
      caption: post.caption,
      like_count: post.likeCount,
      comment_count: post.commentCount,
      created_at: post.createdAt,
      updated_at: post.updatedAt,
      deleted_at: post.deletedAt,
    },
    media: post.media.map((m) => ({ post_id: post.id, media_id: m.mediaId, position: m.position })),
    hashtags: post.hashtags.map((tag, position) => ({ post_id: post.id, tag, position })),
  };
}

/**
 * Page/hydration query rows → `PostView` (assembled per post). `author` is a row with `author_*` aliased
 * columns (a `PostViewRow` works for both `postRow` and `author`); `media`/`tags` are this post's rows and are
 * ordered by `position`.
 */
export function mapPostViewRows(
  postRow: PostRow,
  author: UserSummaryViewRow<"author_">,
  media: PostMediaViewRow[],
  tags: PostHashtagRow[],
  viewerHasLiked: boolean,
): PostView {
  return {
    id: postRow.id as PostId,
    author: mapUserSummaryViewRow(author, "author_"),
    caption: postRow.caption as Caption,
    media: [...media]
      .sort(byPosition)
      .map(({ post_id: _p, position: _pos, ...row }) => mapMediaRowToEntity(row)),
    hashtags: [...tags].sort(byPosition).map((t) => t.tag as Hashtag),
    likeCount: postRow.like_count,
    commentCount: postRow.comment_count,
    viewerHasLiked,
    createdAt: postRow.created_at,
    updatedAt: postRow.updated_at,
  };
}
