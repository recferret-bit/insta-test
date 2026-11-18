/**
 * Post queries & mutations (F-FE-04, F-FE-05; frontend/02 "Query Keys": `["post", postId]`, stale 30 s).
 * Every cached value is a `PostViewModel`; caption edits and deletes are reconciled into every cache that holds the
 * post (feed, explore, profile grid, hashtag, post page) through `patchPostInCaches` / `removePostFromCaches`.
 */
import { LIMITS } from "@insta/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { createPost, deletePost, getPost, updatePost } from "../api/posts";
import { isApiError } from "../api/http";
import { patchPostInCaches } from "./cache-patch";
import { errorMessage } from "./errors";
import {
  toCreatePostDto,
  toPostVM,
  toUpdatePostDto,
  tokenizeCaption,
  type PostViewModel,
} from "./mappers/post";
import { POST_CACHE_ROOTS, queryKeys, STALE_TIMES } from "./query-keys";
import { getSession, useMe } from "./session";

export type { PostViewModel };

function viewerId(): string | null {
  return getSession().me?.id ?? null;
}

/** `GET /posts/{id}` → `PostViewModel` (`isOwn` relative to the signed-in viewer). */
export async function fetchPost(postId: string, signal?: AbortSignal): Promise<PostViewModel> {
  return toPostVM(await getPost(postId, signal), { viewerId: viewerId() });
}

/** Re-derives `isOwn` for the current viewer (a cached post may have been mapped before login). */
export function withViewer(post: PostViewModel, viewer: string | null): PostViewModel {
  const isOwn = viewer !== null && viewer === post.author.id;
  return post.isOwn === isOwn ? post : { ...post, isOwn };
}

export function usePostQuery(postId: string) {
  const viewer = useMe()?.id ?? null;
  return useQuery({
    queryKey: queryKeys.post(postId),
    queryFn: ({ signal }) => fetchPost(postId, signal),
    staleTime: STALE_TIMES.post,
    enabled: postId !== "",
    select: (post) => withViewer(post, viewer),
  });
}

// ---- caption checks (mirror UpdatePostRequestDto / CreatePostRequestDto) ----

export function captionLength(caption: string): number {
  return Array.from(caption).length;
}

/** Unique hashtags in first-appearance order, as the server extracts them. */
export function captionHashtags(caption: string): string[] {
  const tags = new Set<string>();
  for (const token of tokenizeCaption(caption)) if (token.type === "hashtag") tags.add(token.tag);
  return [...tags];
}

/** `null` when the caption may be sent. */
export function captionError(caption: string): string | null {
  if (captionLength(caption) > LIMITS.captionMax)
    return `Captions are at most ${LIMITS.captionMax.toLocaleString("en-US")} characters.`;
  if (captionHashtags(caption).length > LIMITS.hashtagsPerPostMax)
    return `Use at most ${LIMITS.hashtagsPerPostMax} hashtags.`;
  return null;
}

/** Publish / edit failure message; `422 MEDIA_INVALID` gets composer-specific wording. */
export function postErrorMessage(error: unknown): string {
  if (isApiError(error) && error.code === "MEDIA_INVALID")
    return "One of your files can't be used anymore. Remove it and try again.";
  return errorMessage(error);
}

// ---- cache helpers ----

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function withoutItem(items: unknown, postId: string): unknown {
  if (!Array.isArray(items)) return items;
  const next = items.filter((item: unknown) => !(isObject(item) && item.id === postId));
  return next.length === items.length ? items : next;
}

/** Pure: drops `postId` from a paged / infinite list (same reference when absent). Exported for tests. */
export function removePostFromData(data: unknown, postId: string): unknown {
  if (!isObject(data)) return data;
  if (Array.isArray(data.pages)) {
    let changed = false;
    const pages = data.pages.map((page: unknown) => {
      if (!isObject(page)) return page;
      const items = withoutItem(page.items, postId);
      if (items === page.items) return page;
      changed = true;
      return { ...page, items };
    });
    return changed ? { ...data, pages } : data;
  }
  if (Array.isArray(data.items)) {
    const items = withoutItem(data.items, postId);
    return items === data.items ? data : { ...data, items };
  }
  return data;
}

/** Removes a deleted post from every list cache and drops its detail & comments queries. */
export function removePostFromCaches(client: QueryClient, postId: string): void {
  for (const root of POST_CACHE_ROOTS) {
    if (root === "post") continue;
    for (const [key, data] of client.getQueriesData({ queryKey: [root] })) {
      const next = removePostFromData(data, postId);
      if (next !== data) client.setQueryData(key as QueryKey, next);
    }
  }
  client.removeQueries({ queryKey: queryKeys.post(postId), exact: true });
  client.removeQueries({ queryKey: queryKeys.comments(postId), exact: true });
}

/** A fresh post changes the author's grid, counters and (for followers) the feed. */
function invalidateAuthorViews(client: QueryClient, username: string): void {
  void client.invalidateQueries({ queryKey: queryKeys.userPosts(username) });
  void client.invalidateQueries({ queryKey: queryKeys.profile(username) });
  void client.invalidateQueries({ queryKey: queryKeys.me() });
}

// ---- mutations ----

export type CreatePostVariables = { caption: string; mediaIds: string[] };

/** `POST /posts`; seeds `["post", id]` so the post page renders instantly after navigation. */
export function useCreatePostMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ caption, mediaIds }: CreatePostVariables): Promise<PostViewModel> =>
      toPostVM(await createPost(toCreatePostDto(caption, mediaIds)), { viewerId: viewerId() }),
    onSuccess: (post) => {
      client.setQueryData(queryKeys.post(post.id), post);
      invalidateAuthorViews(client, post.author.username);
      void client.invalidateQueries({ queryKey: queryKeys.feed() });
    },
  });
}

export type UpdateCaptionVariables = { postId: string; caption: string };

/** `PATCH /posts/{id}` (caption only); the server response replaces the post in every cache. */
export function useUpdateCaptionMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, caption }: UpdateCaptionVariables): Promise<PostViewModel> =>
      toPostVM(await updatePost(postId, toUpdatePostDto(caption)), { viewerId: viewerId() }),
    onSuccess: (post) => {
      patchPostInCaches(client, post.id, () => post);
      if (client.getQueryData(queryKeys.post(post.id)) === undefined)
        client.setQueryData(queryKeys.post(post.id), post);
      // Hashtag pages depend on the caption.
      void client.invalidateQueries({ queryKey: ["hashtag"] });
    },
  });
}

export type DeletePostVariables = { postId: string; authorUsername: string };

/** `DELETE /posts/{id}`; a `404` (already deleted elsewhere) is treated as success. */
export function useDeletePostMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId }: DeletePostVariables): Promise<void> => {
      try {
        await deletePost(postId);
      } catch (error) {
        if (!(isApiError(error) && error.status === 404)) throw error;
      }
    },
    onSuccess: (_void, { postId, authorUsername }) => {
      removePostFromCaches(client, postId);
      invalidateAuthorViews(client, authorUsername);
    },
  });
}
