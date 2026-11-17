/**
 * Post, like, feed & explore endpoints — external-communication/03-media-and-posts-api.md,
 * 04-social-api.md (likes), 06-feed-search-notifications-api.md (feed, explore).
 */
import {
  LikeStateResponseDto,
  PostPageResponseDto,
  PostResponseDto,
  UserSummaryPageResponseDto,
  type CreatePostRequestDto,
  type UpdatePostRequestDto,
} from "@insta/contracts";

import { request, seg, type InputOf, type PageParams } from "./http";

export type CreatePostBody = InputOf<typeof CreatePostRequestDto>;
export type UpdatePostBody = InputOf<typeof UpdatePostRequestDto>;

/** `POST /posts` → `201 PostResponseDto`. */
export function createPost(body: CreatePostBody, signal?: AbortSignal): Promise<PostResponseDto> {
  return request("POST", "/posts", { body, schema: PostResponseDto, signal });
}

/** `GET /posts/{post_id}` → `200 PostResponseDto`. */
export function getPost(postId: string, signal?: AbortSignal): Promise<PostResponseDto> {
  return request("GET", `/posts/${seg(postId)}`, { schema: PostResponseDto, signal });
}

/** `PATCH /posts/{post_id}` (caption only) → `200 PostResponseDto`. */
export function updatePost(
  postId: string,
  body: UpdatePostBody,
  signal?: AbortSignal,
): Promise<PostResponseDto> {
  return request("PATCH", `/posts/${seg(postId)}`, { body, schema: PostResponseDto, signal });
}

/** `DELETE /posts/{post_id}` → `204`. */
export function deletePost(postId: string, signal?: AbortSignal): Promise<void> {
  return request<void>("DELETE", `/posts/${seg(postId)}`, { signal });
}

/** `GET /users/{username}/posts?cursor&limit` → `200 PostPageResponseDto`. */
export function getUserPosts(
  username: string,
  page: PageParams = {},
  signal?: AbortSignal,
): Promise<PostPageResponseDto> {
  return request("GET", `/users/${seg(username)}/posts`, {
    query: page,
    schema: PostPageResponseDto,
    signal,
  });
}

/** `PUT /posts/{post_id}/like` (idempotent) → `200 LikeStateResponseDto`. */
export function likePost(postId: string, signal?: AbortSignal): Promise<LikeStateResponseDto> {
  return request("PUT", `/posts/${seg(postId)}/like`, { schema: LikeStateResponseDto, signal });
}

/** `DELETE /posts/{post_id}/like` (idempotent) → `200 LikeStateResponseDto`. */
export function unlikePost(postId: string, signal?: AbortSignal): Promise<LikeStateResponseDto> {
  return request("DELETE", `/posts/${seg(postId)}/like`, { schema: LikeStateResponseDto, signal });
}

/** `GET /posts/{post_id}/likes?cursor&limit` → `200 UserSummaryPageResponseDto`. */
export function getPostLikers(
  postId: string,
  page: PageParams = {},
  signal?: AbortSignal,
): Promise<UserSummaryPageResponseDto> {
  return request("GET", `/posts/${seg(postId)}/likes`, {
    query: page,
    schema: UserSummaryPageResponseDto,
    signal,
  });
}

/** `GET /feed?cursor&limit` (auth required) → `200 PostPageResponseDto`. */
export function getFeed(page: PageParams = {}, signal?: AbortSignal): Promise<PostPageResponseDto> {
  return request("GET", "/feed", { query: page, schema: PostPageResponseDto, signal });
}

/** `GET /explore?cursor&limit` → `200 PostPageResponseDto`. */
export function getExplore(page: PageParams = {}, signal?: AbortSignal): Promise<PostPageResponseDto> {
  return request("GET", "/explore", { query: page, schema: PostPageResponseDto, signal });
}
