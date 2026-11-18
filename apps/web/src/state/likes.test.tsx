import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hexId, NOW, post } from "../test/fixtures";
import { configureTestHttp } from "./auth.test-utils";
import { applyLike, useLikeActions, useLikeMutation } from "./likes";
import { toPostVM, type PostViewModel } from "./mappers/post";
import { createQueryClient } from "./queryClient";
import { queryKeys } from "./query-keys";

const ID = hexId("pst", 1);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(initial = post({ like_count: 5, viewer_has_liked: false })) {
  const client = createQueryClient();
  client.setQueryData(queryKeys.post(ID), toPostVM(initial, { viewerId: null, now: NOW }));
  client.setQueryData(queryKeys.feed(), {
    pages: [{ items: [toPostVM(initial, { viewerId: null, now: NOW })], nextCursor: null }],
    pageParams: [undefined],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const read = () => client.getQueryData<PostViewModel>(queryKeys.post(ID));
  const readFeed = () =>
    client.getQueryData<{ pages: Array<{ items: PostViewModel[] }> }>(queryKeys.feed())?.pages[0]?.items[0];
  return { client, wrapper, read, readFeed };
}

describe("applyLike", () => {
  it("toggles state, adjusts the count and labels; no-op when already in that state", () => {
    const p = toPostVM(post({ like_count: 1, viewer_has_liked: false }), { viewerId: null, now: NOW });
    const liked = applyLike(p, true);
    expect(liked).toMatchObject({ viewerHasLiked: true, likeCount: 2, likeCountLabel: "2 likes" });
    expect(applyLike(liked, true)).toBe(liked);
    expect(applyLike(liked, false)).toMatchObject({
      viewerHasLiked: false,
      likeCount: 1,
      likeCountLabel: "1 like",
    });
    expect(applyLike({ ...p, likeCount: 0, viewerHasLiked: true }, false).likeCount).toBe(0);
  });
});

describe("useLikeMutation", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    configureTestHttp(fetchMock as unknown as typeof fetch);
  });

  it("patches every cache optimistically and reconciles with the server count", async () => {
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);
    const { wrapper, read, readFeed } = setup();
    const { result } = renderHook(() => useLikeMutation(), { wrapper });
    act(() => result.current.mutate({ postId: ID, like: true }));
    await waitFor(() => expect(read()?.viewerHasLiked).toBe(true));
    expect(read()?.likeCount).toBe(6);
    expect(readFeed()?.likeCount).toBe(6);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PUT" });
    response.resolve(json(200, { post_id: ID, liked: true, like_count: 42 }));
    await waitFor(() => expect(read()?.likeCount).toBe(42));
    expect(readFeed()).toMatchObject({ likeCount: 42, likeCountLabel: "42 likes" });
  });

  it("rolls back on error", async () => {
    fetchMock.mockResolvedValue(
      json(404, { error: { code: "NOT_FOUND", message: "gone", request_id: "r" } }),
    );
    const { wrapper, read } = setup();
    const { result } = renderHook(() => useLikeMutation(), { wrapper });
    act(() => result.current.mutate({ postId: ID, like: true }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(read()).toMatchObject({ viewerHasLiked: false, likeCount: 5 });
  });

  it("ignores a stale response when a newer toggle is in flight", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { wrapper, read } = setup();
    const { result } = renderHook(() => useLikeMutation(), { wrapper });
    act(() => result.current.mutate({ postId: ID, like: true }));
    await waitFor(() => expect(read()?.viewerHasLiked).toBe(true));
    act(() => result.current.mutate({ postId: ID, like: false }));
    await waitFor(() => expect(read()?.viewerHasLiked).toBe(false));
    first.resolve(json(200, { post_id: ID, liked: true, like_count: 6 }));
    await new Promise((r) => setTimeout(r, 10));
    expect(read()).toMatchObject({ viewerHasLiked: false, likeCount: 5 });
    second.resolve(json(200, { post_id: ID, liked: false, like_count: 5 }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(read()).toMatchObject({ viewerHasLiked: false, likeCount: 5 }));
  });
});

describe("useLikeActions", () => {
  it("likeOnce never unlikes; toggle flips", async () => {
    const fetchMock = vi.fn((_url: string, init: RequestInit) =>
      Promise.resolve(json(200, { post_id: ID, liked: init.method === "PUT", like_count: 1 })),
    );
    configureTestHttp(fetchMock as unknown as typeof fetch);
    const { wrapper } = setup();
    const { result } = renderHook(() => useLikeActions(), { wrapper });
    act(() => result.current.likeOnce({ id: ID, viewerHasLiked: true }));
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => result.current.toggle({ id: ID, viewerHasLiked: true }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "DELETE" });
  });
});
