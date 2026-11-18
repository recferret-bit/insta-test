/**
 * Comments infinite query & mutations (F-FE-05; frontend/02 `["comments", postId]` infinite, stale 30 s).
 * Comments are ordered oldest first (`created_at ASC`), so a new comment belongs at the end of the list: it is
 * appended only once the last page is loaded (otherwise it arrives with the next page and would be duplicated).
 * The post's `commentCount` is updated optimistically in every cache through `patchPostInCaches`.
 */
import { LIMITS } from "@insta/contracts";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import { createComment, deleteComment, getComments } from "../api/comments";
import { isApiError } from "../api/http";
import { patchPostInCaches } from "./cache-patch";
import { toCommentVM, toCreateCommentDto, type CommentViewModel } from "./mappers/comment";
import { toPageVM, type PageViewModel } from "./mappers/format";
import { withPostCounters } from "./mappers/post";
import { queryKeys, STALE_TIMES } from "./query-keys";
import { getSession } from "./session";

export type { CommentViewModel };
export type CommentPages = InfiniteData<PageViewModel<CommentViewModel>, string | undefined>;

function viewerId(): string | null {
  return getSession().me?.id ?? null;
}

/**
 * Comments of a post. `postAuthorId` is needed for `canDelete` (post owners moderate comments), so the query only
 * runs once the post is known.
 */
export function useCommentsQuery(postId: string, postAuthorId: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.comments(postId),
    queryFn: async ({ pageParam, signal }) => {
      const page = await getComments(postId, { cursor: pageParam }, signal);
      const ctx = { viewerId: viewerId(), postAuthorId: postAuthorId ?? null };
      return toPageVM(page, (dto) => toCommentVM(dto, ctx));
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: STALE_TIMES.comments,
    enabled: postId !== "" && postAuthorId !== undefined,
  });
}

/** `null` when the comment may be sent (1–500 characters after trim). */
export function commentError(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Write a comment first.";
  if (Array.from(trimmed).length > LIMITS.commentMax)
    return `Comments are at most ${LIMITS.commentMax} characters.`;
  return null;
}

/** Pure: appends `comment` to the last page when the list is fully loaded; no-op otherwise or if present. */
export function appendComment(
  data: CommentPages | undefined,
  comment: CommentViewModel,
): CommentPages | undefined {
  if (!data || data.pages.length === 0) return data;
  if (data.pages.some((p) => p.items.some((c) => c.id === comment.id))) return data;
  const lastIndex = data.pages.length - 1;
  const last = data.pages[lastIndex];
  if (!last || last.nextCursor !== null) return data;
  const pages = data.pages.slice();
  pages[lastIndex] = { ...last, items: [...last.items, comment] };
  return { ...data, pages };
}

/** Pure: removes `commentId` from every page (same reference when absent). */
export function removeComment(data: CommentPages | undefined, commentId: string): CommentPages | undefined {
  if (!data) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    const items = page.items.filter((c) => c.id !== commentId);
    if (items.length === page.items.length) return page;
    changed = true;
    return { ...page, items };
  });
  return changed ? { ...data, pages } : data;
}

function bumpCommentCount(client: QueryClient, postId: string, delta: number) {
  return patchPostInCaches(client, postId, (post) =>
    withPostCounters(post, { commentCount: post.commentCount + delta }),
  );
}

export type CreateCommentVariables = { postId: string; postAuthorId: string | null; text: string };

export function useCreateCommentMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, postAuthorId, text }: CreateCommentVariables): Promise<CommentViewModel> =>
      toCommentVM(await createComment(postId, toCreateCommentDto(text)), {
        viewerId: viewerId(),
        postAuthorId,
      }),
    onMutate: ({ postId }: CreateCommentVariables) => bumpCommentCount(client, postId, 1),
    onError: (_error, _vars, context) => context?.rollback(),
    onSuccess: (comment, { postId }) => {
      client.setQueryData<CommentPages>(queryKeys.comments(postId), (data) => appendComment(data, comment));
    },
  });
}

export type DeleteCommentVariables = { postId: string; commentId: string };

/** Optimistically removes the comment and decrements the count; a `404` (already gone) counts as success. */
export function useDeleteCommentMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId }: DeleteCommentVariables): Promise<void> => {
      try {
        await deleteComment(commentId);
      } catch (error) {
        if (!(isApiError(error) && error.status === 404)) throw error;
      }
    },
    onMutate: async ({ postId, commentId }: DeleteCommentVariables) => {
      const key = queryKeys.comments(postId);
      await client.cancelQueries({ queryKey: key, exact: true });
      const previous = client.getQueryData<CommentPages>(key);
      const next = removeComment(previous, commentId);
      if (next !== previous) client.setQueryData(key, next);
      const counter = bumpCommentCount(client, postId, -1);
      return {
        rollback: () => {
          if (next !== previous) client.setQueryData(key, previous);
          counter.rollback();
        },
      };
    },
    onError: (_error, _vars, context) => context?.rollback(),
  });
}
