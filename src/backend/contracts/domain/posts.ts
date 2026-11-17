import type { UserSummaryView } from "./identity.ts";
import type { MediaAsset } from "./media.ts";
import type { Brand, CommentId, MediaId, PostId, UserId } from "./shared/ids.ts";

/** ENT-Post, ENT-Comment, ENT-Like business entities (backend/01-business-entities.md#post, #comment, #like). */

export type Caption = Brand<string, "Caption">; // trimmed, ≤ 2200
export type Hashtag = Brand<string, "Hashtag">; // lowercased, 1–64 [\p{L}\p{N}_]
export type PostMediaItem = { mediaId: MediaId; position: number }; // 0..9

export type Post = {
  id: PostId;
  authorId: UserId;
  caption: Caption;
  media: PostMediaItem[]; // 1..10, positions contiguous from 0
  hashtags: Hashtag[]; // derived from caption, ≤ 30, first-appearance order
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type PostView = {
  id: PostId;
  author: UserSummaryView;
  caption: Caption;
  media: MediaAsset[]; // ordered by position
  hashtags: Hashtag[];
  likeCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePostCommand = { authorId: UserId; caption: string; mediaIds: MediaId[] };
export type UpdatePostCaptionCommand = { postId: PostId; actorId: UserId; caption: string };

export type CommentText = Brand<string, "CommentText">; // trimmed, 1–500

export type Comment = {
  id: CommentId;
  postId: PostId;
  authorId: UserId;
  text: CommentText;
  createdAt: Date;
  deletedAt: Date | null;
};

export type CommentView = {
  id: CommentId;
  postId: PostId;
  author: UserSummaryView;
  text: CommentText;
  createdAt: Date;
};

export type CreateCommentCommand = { postId: PostId; authorId: UserId; text: string };

export type Like = { postId: PostId; userId: UserId; createdAt: Date };
export type LikeState = { postId: PostId; liked: boolean; likeCount: number };
export type LikeCommand = { postId: PostId; userId: UserId };

/** Hashtag stats for search results. */
export type HashtagStat = { tag: Hashtag; postCount: number };
