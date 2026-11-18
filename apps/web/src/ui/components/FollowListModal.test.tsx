import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation, useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureTestHttp } from "../../state/auth.test-utils";
import type { FollowListKind } from "../../state/follows";
import { toMeVM } from "../../state/mappers/user";
import { createQueryClient } from "../../state/queryClient";
import { clearSession, setSession } from "../../state/session";
import { hexId, me, userSummary } from "../../test/fixtures";
import { FollowListModal } from "./FollowListModal";

const FUTURE = "2099-01-01T00:00:00.000Z";
const VIEWER_ID = hexId("usr", 1);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function item(n: number, overrides: Parameters<typeof userSummary>[0] = {}) {
  return {
    ...userSummary({ id: hexId("usr", 100 + n), username: `user${n}`, full_name: `User ${n}`, ...overrides }),
    followed_at: "2026-11-01T00:00:00.000Z",
  };
}

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

function ModalRoute({ kind }: { kind: FollowListKind }) {
  const { username = "" } = useParams();
  return (
    <>
      <Where />
      <FollowListModal username={username} kind={kind} />
    </>
  );
}

describe("FollowListModal", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function renderAt(path: string) {
    const client = createQueryClient();
    const router = createMemoryRouter(
      [
        { path: "/u/:username/followers", element: <ModalRoute kind="followers" /> },
        { path: "/u/:username/following", element: <ModalRoute kind="following" /> },
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

  beforeEach(() => {
    fetchMock = vi.fn();
    configureTestHttp(fetchMock);
    setSession({ token: "tok", expiresAt: FUTURE, me: toMeVM(me({ id: VIEWER_ID, username: "alice" })) });
  });

  afterEach(() => clearSession());

  it("lists followers with follow buttons in an accessible dialog", async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        items: [
          item(1, { is_following: true }),
          item(2, { is_following: false }),
          item(3, { id: VIEWER_ID, username: "alice" }),
        ],
        next_cursor: null,
      }),
    );
    renderAt("/u/bob/followers");
    const dialog = screen.getByRole("dialog", { name: "Followers" });
    expect(within(dialog).getByRole("status").textContent).toContain("Loading followers");

    const list = await within(dialog).findByRole("list", { name: "Followers of bob" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByRole("link", { name: /user1/ }).getAttribute("href")).toBe("/u/user1");
    expect(within(list).getByRole("button", { name: "Unfollow user1" })).toBeTruthy();
    expect(within(list).getByRole("button", { name: "Follow user2" })).toBeTruthy();
    // No button for the viewer's own row.
    expect(within(list).queryByRole("button", { name: /alice/ })).toBeNull();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.test/api/v1/users/bob/followers");
  });

  it("uses the following endpoint and title", async () => {
    fetchMock.mockResolvedValue(json(200, { items: [item(1)], next_cursor: null }));
    renderAt("/u/bob/following");
    expect(screen.getByRole("dialog", { name: "Following" })).toBeTruthy();
    await screen.findByRole("list", { name: "Following of bob" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.test/api/v1/users/bob/following");
  });

  it("shows an empty state", async () => {
    fetchMock.mockResolvedValue(json(200, { items: [], next_cursor: null }));
    renderAt("/u/bob/followers");
    expect(await screen.findByRole("heading", { name: "No followers yet" })).toBeTruthy();
  });

  it("shows an inline error with retry", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(404, { error: { code: "NOT_FOUND", message: "User not found", request_id: "r" } }),
      )
      .mockResolvedValueOnce(json(200, { items: [item(1)], next_cursor: null }));
    renderAt("/u/ghost/followers");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("User not found");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("list", { name: "Followers of ghost" })).toBeTruthy();
  });

  it("loads the next page with the cursor", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { items: [item(1)], next_cursor: "cur_2" }))
      .mockResolvedValueOnce(json(200, { items: [item(2)], next_cursor: null }));
    renderAt("/u/bob/followers");
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://api.test/api/v1/users/bob/followers?cursor=cur_2");
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("auto-loads the next page when the sentinel becomes visible", async () => {
    const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    class FakeObserver {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observers.push(cb);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    try {
      fetchMock
        .mockResolvedValueOnce(json(200, { items: [item(1)], next_cursor: "cur_2" }))
        .mockResolvedValueOnce(json(200, { items: [item(2)], next_cursor: null }));
      renderAt("/u/bob/followers");
      await screen.findByRole("list");
      await waitFor(() => expect(observers.length).toBeGreaterThan(0));
      observers.at(-1)!([{ isIntersecting: true }]);
      await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("Esc closes back to the profile", async () => {
    fetchMock.mockResolvedValue(json(200, { items: [item(1)], next_cursor: null }));
    renderAt("/u/bob/followers");
    await screen.findByRole("list");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/u/bob"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the close button closes back to the profile and focus starts inside the dialog", async () => {
    fetchMock.mockResolvedValue(json(200, { items: [item(1)], next_cursor: null }));
    renderAt("/u/bob/following");
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/u/bob"));
  });

  it("following a user from the list updates the row", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { items: [item(1, { is_following: false })], next_cursor: null }))
      .mockResolvedValueOnce(json(200, { user_id: hexId("usr", 101), following: true, followers_count: 1 }))
      .mockResolvedValue(json(200, { items: [item(1, { is_following: true })], next_cursor: null }));
    renderAt("/u/bob/followers");
    fireEvent.click(await screen.findByRole("button", { name: "Follow user1" }));
    expect(await screen.findByRole("button", { name: "Unfollow user1" })).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/v1/users/user1/follow");
    expect(init.method).toBe("PUT");
  });
});
