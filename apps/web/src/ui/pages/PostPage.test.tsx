import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureTestHttp } from "../../state/auth.test-utils";
import { toMeVM } from "../../state/mappers/user";
import { createQueryClient } from "../../state/queryClient";
import { clearSession, setSession } from "../../state/session";
import { comment, hexId, me, post, userSummary } from "../../test/fixtures";
import { PostPage } from "./PostPage";

const FUTURE = "2099-01-01T00:00:00.000Z";
const ID = hexId("pst", 1);
const BOB = userSummary({ id: hexId("usr", 2), username: "bob", full_name: "Bob" });

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

function renderPage(path = `/p/${ID}`) {
  const client = createQueryClient();
  const router = createMemoryRouter(
    [
      { path: "/p/:postId", element: <PostPage /> },
      { path: "*", element: <Where /> },
    ],
    { initialEntries: [path], future: { v7_relativeSplatPath: true } },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
  return { client, router };
}

type Handler = (url: URL, init: RequestInit) => Response | undefined;

describe("PostPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let override: Handler | null;
  let created = 0;

  beforeEach(() => {
    override = null;
    created = 0;
    fetchMock = vi.fn((raw: string, init: RequestInit) => {
      const url = new URL(raw);
      const custom = override?.(url, init);
      if (custom) return Promise.resolve(custom);
      const p = url.pathname.replace("/api/v1", "");
      if (p === `/posts/${ID}` && init.method === "GET")
        return Promise.resolve(json(200, post({ like_count: 2, comment_count: 3 })));
      if (p === `/posts/${ID}/comments` && init.method === "GET") {
        const cursor = url.searchParams.get("cursor");
        return Promise.resolve(
          json(
            200,
            cursor
              ? { items: [comment({ id: hexId("cmt", 3), text: "Third" })], next_cursor: null }
              : {
                  items: [
                    comment({ id: hexId("cmt", 1), text: "First" }),
                    comment({ id: hexId("cmt", 2), text: "Second", author: userSummary() }),
                  ],
                  next_cursor: "cur1",
                },
          ),
        );
      }
      if (p === `/posts/${ID}/comments` && init.method === "POST") {
        created++;
        const { text } = JSON.parse(init.body as string) as { text: string };
        return Promise.resolve(json(201, comment({ id: hexId("cmt", 10 + created), text, author: BOB })));
      }
      if (p === `/posts/${ID}/like`)
        return Promise.resolve(json(200, { post_id: ID, liked: init.method === "PUT", like_count: 3 }));
      if (p.startsWith("/comments/") && init.method === "DELETE") return Promise.resolve(json(204));
      if (p === `/posts/${ID}` && init.method === "DELETE") return Promise.resolve(json(204));
      return Promise.reject(new Error(`unexpected ${init.method} ${raw}`));
    });
    configureTestHttp(fetchMock as unknown as typeof fetch);
    setSession({ token: "tok", expiresAt: FUTURE, me: toMeVM(me({ id: BOB.id, username: "bob" })) });
  });

  afterEach(() => clearSession());

  it("renders the post with its first comments page and loads more on demand", async () => {
    renderPage();
    expect(await screen.findByRole("article", { name: "Post by @alice" })).toBeTruthy();
    expect(screen.getByText("2 likes")).toBeTruthy();
    expect(await screen.findByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Comments (3)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more comments" }));
    expect(await screen.findByText("Third")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load more comments" })).toBeNull();
  });

  it("likes optimistically from the heart button", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Like" }));
    expect(await screen.findByRole("button", { name: "Unlike" })).toBeTruthy();
    expect(screen.getByText("3 likes")).toBeTruthy();
  });

  it("posts a comment with Enter, bumps the count and appends it once the list is complete", async () => {
    renderPage();
    await screen.findByText("First");
    fireEvent.click(screen.getByRole("button", { name: "Load more comments" }));
    await screen.findByText("Third");
    const box = screen.getByLabelText("Add a comment") as HTMLTextAreaElement;
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: "So pretty" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(await screen.findByText("So pretty")).toBeTruthy();
    await waitFor(() => expect(box.value).toBe(""));
    expect(screen.getByRole("heading", { name: "Comments (4)" })).toBeTruthy();
  });

  it("lets a comment's author delete it (and only theirs, on someone else's post)", async () => {
    renderPage();
    await screen.findByText("First");
    const list = screen.getByRole("list", { name: "Comments" });
    // bob wrote "First"; alice wrote "Second" on her own post.
    expect(within(list).getAllByRole("button", { name: /Delete comment/ })).toHaveLength(1);
    fireEvent.click(within(list).getByRole("button", { name: "Delete comment by @bob" }));
    await waitFor(() => expect(screen.queryByText("First")).toBeNull());
    expect(screen.getByRole("heading", { name: "Comments (2)" })).toBeTruthy();
    const del = fetchMock.mock.calls.find(([, i]) => (i as RequestInit).method === "DELETE");
    expect(del?.[0]).toBe(`http://api.test/api/v1/comments/${hexId("cmt", 1)}`);
  });

  it("lets the post author delete the post and returns to their profile", async () => {
    setSession({ token: "tok", expiresAt: FUTURE, me: toMeVM(me()) });
    renderPage();
    await screen.findByText("First");
    expect(screen.getAllByRole("button", { name: /Delete comment/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/u/alice"));
  });

  it("shows a not-found state for missing posts", async () => {
    override = (url) =>
      url.pathname.endsWith(`/posts/${ID}`)
        ? json(404, { error: { code: "NOT_FOUND", message: "Post not found", request_id: "r" } })
        : undefined;
    renderPage();
    expect(await screen.findByRole("heading", { name: "Post not available" })).toBeTruthy();
  });

  it("invites anonymous visitors to log in instead of showing the composer", async () => {
    clearSession();
    renderPage();
    await screen.findByText("First");
    expect(screen.queryByLabelText("Add a comment")).toBeNull();
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe(
      `/login?next=${encodeURIComponent(`/p/${ID}`)}`,
    );
    expect(screen.queryByRole("button", { name: /Delete comment/ })).toBeNull();
  });
});
