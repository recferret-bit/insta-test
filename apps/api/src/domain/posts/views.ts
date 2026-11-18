import type { UserSummaryView } from "../identity/views.js";
import type { MediaAsset } from "../media/media-asset.entity.js";
import type { CommentId, PostId } from "../shared/ids.js";
import type { CommentText } from "./comment.entity.js";
import type { Caption, Hashtag } from "./post.entity.js";

export type PostView = {
  id: PostId;
  author: UserSummaryView;
  caption: Caption;
  /** Ordered by position. */
  media: MediaAsset[];
  hashtags: Hashtag[];
  likeCount: number;
  commentCount: number;
  /** `false` when anonymous. */
  viewerHasLiked: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CommentView = {
  id: CommentId;
  postId: PostId;
  author: UserSummaryView;
  text: CommentText;
  createdAt: Date;
};
