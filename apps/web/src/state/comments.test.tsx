import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { comment, hexId, NOW, post } from "../test/fixtures";
import { configureTestHttp } from "./auth.test-utils";
import {
  appendComment,
  commentError,
  removeComment,
  useCreateCommentMutation,
  useDeleteCommentMutation,
  type CommentPages,
} from "./comments";
import { toCommentVM } from "./mappers/comment";
import { toPostVM, type PostViewModel } from "./mappers/post";
import { createQueryClient } from "./queryClient";
import { queryKeys } from "./query-keys";

const POST = hexId("pst", 1);
const ctx = { viewerId: null, postAuthorId: null, now: NOW };
const c = (n: number) => toCommentVM(comment({ id: hexId("cmt", n) }), ctx);

function pages(...ps: Array<{ ids: number[]; next: string | null }>): CommentPages {
  return {
    pages: ps.map((p) => ({ items: p.ids.map(c), nextCursor: p.next })),
    pageParams: ps.map((_, i) => (i === 0 ? undefined : `c${i}`)),
  };
}

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("commentError", () => {
  it("requires 1–500 characters after trim", () => {
    expect(commentError("   ")).toBe("Write a comment first.");
    expect(commentError(" a ")).toBeNull();
    expect(commentError("x".repeat(500))).toBeNull();
    expect(commentError("x".repeat(501))).toBe("Comments are at most 500 characters.");
  });
});

describe("appendComment / removeComment", () => {
  it("appends only when the last page is loaded, and never twice", () => {
    const complete = pages({ ids: [1], next: "c1" }, { ids: [2], next: null });
    const next = appendComment(complete, c(3));
    expect(next?.pages[1]?.items.map((x) => x.id)).toEqual([hexId("cmt", 2), hexId("cmt", 3)]);
    expect(appendComment(next, c(3))).toBe(next);
    const partial = pages({ ids: [1], next: "c1" });
    expect(appendComment(partial, c(3))).toBe(partial);
    expect(appendComment(undefined, c(3))).toBeUndefined();
  });

  it("removes from any page; same reference when absent", () => {
    const data = pages({ ids: [1, 2], next: "c1" }, { ids: [3], next: null });
    expect(removeComment(data, hexId("cmt", 2))?.pages[0]?.items.map((x) => x.id)).toEqual([hexId("cmt", 1)]);
    expect(removeComment(data, hexId("cmt", 9))).toBe(data);
  });
});

describe("comment mutations", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: ReturnType<typeof createQueryClient>;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;
  const readPost = () => client.getQueryData<PostViewModel>(queryKeys.post(POST));

  beforeEach(() => {
    fetchMock = vi.fn();
    configureTestHttp(fetchMock as unknown as typeof fetch);
    client = createQueryClient();
    client.setQueryData(
      queryKeys.post(POST),
      toPostVM(post({ comment_count: 1 }), { viewerId: null, now: NOW }),
    );
    client.setQueryData(queryKeys.comments(POST), pages({ ids: [1], next: null }));
    wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  });

  it("create: bumps the count optimistically and appends the server comment", async () => {
    let release!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (release = r)));
    const { result } = renderHook(() => useCreateCommentMutation(), { wrapper });
    act(() => result.current.mutate({ postId: POST, postAuthorId: null, text: "  hi  " }));
    await waitFor(() => expect(readPost()?.commentCount).toBe(2));
    expect(readPost()?.viewCommentsLabel).toBe("View all 2 comments");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body as string)).toEqual({ text: "hi" });
    release(json(201, comment({ id: hexId("cmt", 7), text: "hi" })));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const list = client.getQueryData<CommentPages>(queryKeys.comments(POST));
    expect(list?.pages[0]?.items.map((x) => x.text)).toEqual(["Nice!", "hi"]);
  });

  it("create: rolls back the count on error", async () => {
    fetchMock.mockResolvedValue(
      json(404, { error: { code: "NOT_FOUND", message: "gone", request_id: "r" } }),
    );
    const { result } = renderHook(() => useCreateCommentMutation(), { wrapper });
    act(() => result.current.mutate({ postId: POST, postAuthorId: null, text: "hi" }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(readPost()?.commentCount).toBe(1);
  });

  it("delete: removes optimistically, rolls back on 403", async () => {
    fetchMock.mockResolvedValue(json(403, { error: { code: "FORBIDDEN", message: "no", request_id: "r" } }));
    const { result } = renderHook(() => useDeleteCommentMutation(), { wrapper });
    act(() => result.current.mutate({ postId: POST, commentId: hexId("cmt", 1) }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<CommentPages>(queryKeys.comments(POST))?.pages[0]?.items).toHaveLength(1);
    expect(readPost()?.commentCount).toBe(1);
  });

  it("delete: treats 404 as success", async () => {
    fetchMock.mockResolvedValue(
      json(404, { error: { code: "NOT_FOUND", message: "gone", request_id: "r" } }),
    );
    const { result } = renderHook(() => useDeleteCommentMutation(), { wrapper });
    act(() => result.current.mutate({ postId: POST, commentId: hexId("cmt", 1) }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<CommentPages>(queryKeys.comments(POST))?.pages[0]?.items).toHaveLength(0);
    expect(readPost()?.commentCount).toBe(0);
  });
});
