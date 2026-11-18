/**
 * Optimistic like / unlike (F-FE-05; frontend/02 "Mutations … are optimistic: patch every cached PostViewModel …
 * via `patchPostInCaches`, roll back on error, and reconcile with the server response").
 *
 * Rapid toggles on one post produce several in-flight requests; only the most recent one per post may reconcile or
 * roll back, so an older response can never overwrite a newer optimistic state.
 */
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { likePost, unlikePost } from "../api/posts";
import { patchPostInCaches } from "./cache-patch";
import { withPostCounters, type PostViewModel } from "./mappers/post";
import { queryKeys } from "./query-keys";

export type LikeVariables = { postId: string; like: boolean };

/** Pure optimistic transition; no-op when the post is already in the requested state. */
export function applyLike(post: PostViewModel, like: boolean): PostViewModel {
  if (post.viewerHasLiked === like) return post;
  return withPostCounters(post, { viewerHasLiked: like, likeCount: post.likeCount + (like ? 1 : -1) });
}

const latestRequest = new Map<string, number>();
let sequence = 0;

type LikeContext = { seq: number; rollback: () => void };

function isLatest(postId: string, seq: number): boolean {
  return latestRequest.get(postId) === seq;
}

function settle(postId: string, seq: number): void {
  if (isLatest(postId, seq)) latestRequest.delete(postId);
}

export function likeMutationOptions(client: QueryClient) {
  return {
    mutationFn: ({ postId, like }: LikeVariables) => (like ? likePost(postId) : unlikePost(postId)),
    onMutate: async ({ postId, like }: LikeVariables): Promise<LikeContext> => {
      const seq = ++sequence;
      latestRequest.set(postId, seq);
      // An in-flight refetch of the post must not overwrite the optimistic state.
      await client.cancelQueries({ queryKey: queryKeys.post(postId), exact: true });
      const { rollback } = patchPostInCaches(client, postId, (post) => applyLike(post, like));
      return { seq, rollback };
    },
    onError: (_error: unknown, { postId }: LikeVariables, context: LikeContext | undefined) => {
      if (!context || !isLatest(postId, context.seq)) return;
      context.rollback();
      settle(postId, context.seq);
    },
    onSuccess: (
      state: { post_id: string; liked: boolean; like_count: number },
      { postId }: LikeVariables,
      context: LikeContext | undefined,
    ) => {
      if (!context || !isLatest(postId, context.seq)) return;
      patchPostInCaches(client, postId, (post) =>
        withPostCounters(post, { viewerHasLiked: state.liked, likeCount: state.like_count }),
      );
      settle(postId, context.seq);
    },
  };
}

export function useLikeMutation() {
  const client = useQueryClient();
  return useMutation(likeMutationOptions(client));
}

export type LikeActions = {
  /** Heart button: like ⇄ unlike. */
  toggle: (post: Pick<PostViewModel, "id" | "viewerHasLiked">) => void;
  /** Double-tap / double-click on media: likes, never unlikes. */
  likeOnce: (post: Pick<PostViewModel, "id" | "viewerHasLiked">) => void;
};

export function useLikeActions(): LikeActions {
  const { mutate } = useLikeMutation();
  const toggle = useCallback<LikeActions["toggle"]>(
    (post) => mutate({ postId: post.id, like: !post.viewerHasLiked }),
    [mutate],
  );
  const likeOnce = useCallback<LikeActions["likeOnce"]>(
    (post) => {
      if (!post.viewerHasLiked) mutate({ postId: post.id, like: true });
    },
    [mutate],
  );
  return { toggle, likeOnce };
}
