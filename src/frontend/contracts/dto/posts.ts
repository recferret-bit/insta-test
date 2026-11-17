// Source: docs/specs/external-communication/03-media-and-posts-api.md, 04-social-api.md (likes, comments).
import type { CommentId, MediaId, PostId } from "../ids.ts";
import type { Page } from "../pagination.ts";
import type { MediaResponseDto, UserSummaryDto } from "./common.ts";

export type CreatePostRequestDto = {
  caption?: string;
  /** 1–10 unique med_… IDs; order = display order. */
  media_ids: MediaId[];
};

export type UpdatePostRequestDto = { caption: string };

export type PostResponseDto = {
  id: PostId;
  author: UserSummaryDto;
  caption: string;
  media: MediaResponseDto[];
  hashtags: string[];
  like_count: number;
  comment_count: number;
  viewer_has_liked: boolean;
  created_at: string;
  updated_at: string;
};

export type PostPageResponseDto = Page<PostResponseDto>;

export type LikeStateResponseDto = {
  post_id: PostId;
  liked: boolean;
  like_count: number;
};

export type CreateCommentRequestDto = { text: string };

export type CommentResponseDto = {
  id: CommentId;
  post_id: PostId;
  author: UserSummaryDto;
  text: string;
  created_at: string;
};

export type CommentPageResponseDto = Page<CommentResponseDto>;
