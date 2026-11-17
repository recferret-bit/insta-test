/** Search & hashtag endpoints — external-communication/06-feed-search-notifications-api.md. */
import { HashtagPostsResponseDto, HashtagSearchResponseDto, UserSearchResponseDto } from "@insta/contracts";

import { request, seg, type PageParams } from "./http";

/** `GET /search/users?q&limit` (q 1–50 chars, limit 1–30) → `200 UserSearchResponseDto`. */
export function searchUsers(q: string, limit?: number, signal?: AbortSignal): Promise<UserSearchResponseDto> {
  return request("GET", "/search/users", { query: { q, limit }, schema: UserSearchResponseDto, signal });
}

/** `GET /search/hashtags?q&limit` (q 1–64 chars, limit 1–30) → `200 HashtagSearchResponseDto`. */
export function searchHashtags(
  q: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<HashtagSearchResponseDto> {
  return request("GET", "/search/hashtags", {
    query: { q, limit },
    schema: HashtagSearchResponseDto,
    signal,
  });
}

/** `GET /hashtags/{tag}/posts?cursor&limit` → `200 HashtagPostsResponseDto`. */
export function getHashtagPosts(
  tag: string,
  page: PageParams = {},
  signal?: AbortSignal,
): Promise<HashtagPostsResponseDto> {
  return request("GET", `/hashtags/${seg(tag)}/posts`, {
    query: page,
    schema: HashtagPostsResponseDto,
    signal,
  });
}
