import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureTestHttp } from "../../state/auth.test-utils";
import { toMeVM } from "../../state/mappers/user";
import { toPostVM, type PostViewModel } from "../../state/mappers/post";
import { createQueryClient } from "../../state/queryClient";
import { queryKeys } from "../../state/query-keys";
import { clearSession, setSession } from "../../state/session";
import { clearToasts, getToasts } from "../../state/toast";
import { hexId, me, NOW, post } from "../../test/fixtures";
import { PostMenu } from "./PostMenu";

const ID = hexId("pst", 1);
const FUTURE = "2099-01-01T00:00:00.000Z";

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setup(onDeleted = vi.fn()) {
  const client = createQueryClient();
  const vm = toPostVM(post(), { viewerId: hexId("usr", 1), now: NOW });
  client.setQueryData(queryKeys.post(ID), vm);
  client.setQueryData(queryKeys.userPosts("alice"), {
    pages: [{ items: [vm], nextCursor: null }],
    pageParams: [undefined],
  });
  const router = createMemoryRouter([{ path: "/", element: <PostMenu post={vm} onDeleted={onDeleted} /> }], {
    future: { v7_relativeSplatPath: true },
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
  return { client, onDeleted };
}

describe("PostMenu", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    configureTestHttp(fetchMock as unknown as typeof fetch);
    setSession({ token: "tok", expiresAt: FUTURE, me: toMeVM(me()) });
  });
  afterEach(() => {
    clearSession();
    clearToasts();
  });

  it("edits the caption and patches every cache with the server response", async () => {
    fetchMock.mockResolvedValue(
      json(200, post({ caption: "New #words", hashtags: ["words"], updated_at: "2026-11-17T10:00:00.000Z" })),
    );
    const { client } = setup();
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit caption" }));
    const box = screen.getByLabelText("Caption") as HTMLTextAreaElement;
    expect(box.value).toBe("Sunset at the #Beach with @bob");
    expect(screen.getByText("30/2200")).toBeTruthy();
    fireEvent.change(box, { target: { value: "New #words" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://api.test/api/v1/posts/${ID}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ caption: "New #words" });
    expect(client.getQueryData<PostViewModel>(queryKeys.post(ID))).toMatchObject({
      caption: "New #words",
      isEdited: true,
    });
    const grid = client.getQueryData<{ pages: Array<{ items: PostViewModel[] }> }>(
      queryKeys.userPosts("alice"),
    );
    expect(grid?.pages[0]?.items[0]?.caption).toBe("New #words");
    expect(getToasts().map((t) => t.message)).toContain("Caption updated.");
  });

  it("rejects too many hashtags client-side", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit caption" }));
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: tags } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Use at most 30 hashtags.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes after confirmation and removes the post from caches", async () => {
    fetchMock.mockResolvedValue(json(204));
    const { client, onDeleted } = setup();
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete post?" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "DELETE" });
    expect(client.getQueryData(queryKeys.post(ID))).toBeUndefined();
    const grid = client.getQueryData<{ pages: Array<{ items: unknown[] }> }>(queryKeys.userPosts("alice"));
    expect(grid?.pages[0]?.items).toEqual([]);
  });

  it("keeps the confirm dialog open with an error when delete fails", async () => {
    fetchMock.mockResolvedValue(
      json(403, { error: { code: "FORBIDDEN", message: "Not yours", request_id: "r" } }),
    );
    const { onDeleted } = setup();
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Not yours")).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
