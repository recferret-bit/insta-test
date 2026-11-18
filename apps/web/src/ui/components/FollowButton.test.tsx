import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureTestHttp } from "../../state/auth.test-utils";
import { FOLLOW_ERROR_MESSAGE } from "../../state/follows";
import { toMeVM, toProfileVM, type ProfileViewModel } from "../../state/mappers/user";
import { queryKeys } from "../../state/query-keys";
import { createQueryClient } from "../../state/queryClient";
import { clearSession, setSession } from "../../state/session";
import { clearToasts, getToasts } from "../../state/toast";
import { hexId, me, profile } from "../../test/fixtures";
import { FollowButton, type FollowButtonUser } from "./FollowButton";

const FUTURE = "2099-01-01T00:00:00.000Z";
const VIEWER_ID = hexId("usr", 1);
const BOB_ID = hexId("usr", 2);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** Reads the user from the `["profile", "bob"]` cache, like the profile page does. */
function CachedBobButton() {
  const { data: p } = useQuery<ProfileViewModel>({
    queryKey: queryKeys.profile("bob"),
    queryFn: () => Promise.reject(new Error("cache only")),
    enabled: false,
  });
  return p ? <FollowButton user={p} /> : null;
}

function signIn() {
  setSession({ token: "tok", expiresAt: FUTURE, me: toMeVM(me({ id: VIEWER_ID, username: "alice" })) });
}

describe("FollowButton", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: ReturnType<typeof createQueryClient>;

  function renderButton(user: FollowButtonUser | "cached", path = "/u/bob") {
    const element = user === "cached" ? <CachedBobButton /> : <FollowButton user={user} />;
    const router = createMemoryRouter([{ path: "*", element }], {
      initialEntries: [path],
      future: { v7_relativeSplatPath: true },
    });
    return render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </QueryClientProvider>,
    );
  }

  beforeEach(() => {
    fetchMock = vi.fn();
    client = createQueryClient();
    configureTestHttp(fetchMock);
  });

  afterEach(() => {
    clearSession();
    clearToasts();
  });

  it("links to login with ?next when signed out", () => {
    renderButton({ id: BOB_ID, username: "bob", isFollowing: null }, "/u/bob/followers");
    const link = screen.getByRole("link", { name: "Log in to follow bob" });
    expect(link.getAttribute("href")).toBe(`/login?next=${encodeURIComponent("/u/bob/followers")}`);
    expect(link.textContent).toBe("Follow");
  });

  it("renders nothing for the viewer's own account", () => {
    signIn();
    const { container } = renderButton({ id: VIEWER_ID, username: "alice", isFollowing: null });
    expect(container.querySelector("button")).toBeNull();
  });

  it("shows Follow / Following from isFollowing", () => {
    signIn();
    renderButton({ id: BOB_ID, username: "bob", isFollowing: true });
    const button = screen.getByRole("button", { name: "Unfollow bob" });
    expect(button.textContent).toBe("Following");
    expect(button.className).toContain("btn--secondary");
  });

  it("toggles optimistically, ignores clicks while pending, and reconciles", async () => {
    signIn();
    client.setQueryData(
      queryKeys.profile("bob"),
      toProfileVM(
        profile({ id: BOB_ID, username: "bob", is_following: false, followers_count: 3 }),
        VIEWER_ID,
      ),
    );
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);
    renderButton("cached");

    fireEvent.click(screen.getByRole("button", { name: "Follow bob" }));
    const pending = await screen.findByRole("button", { name: "Unfollow bob" });
    expect(pending.textContent).toBe("Following");
    expect(pending.getAttribute("aria-disabled")).toBe("true");
    expect(client.getQueryData<ProfileViewModel>(queryKeys.profile("bob"))?.followersCount).toBe(4);

    fireEvent.click(pending);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      response.resolve(json(200, { user_id: BOB_ID, following: true, followers_count: 4 }));
      await response.promise;
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Unfollow bob" }).getAttribute("aria-disabled")).toBeNull(),
    );
    expect(client.getQueryData<ProfileViewModel>(queryKeys.profile("bob"))?.isFollowing).toBe(true);
  });

  it("rolls back to Follow and toasts when the request fails", async () => {
    signIn();
    client.setQueryData(
      queryKeys.profile("bob"),
      toProfileVM(
        profile({ id: BOB_ID, username: "bob", is_following: false, followers_count: 3 }),
        VIEWER_ID,
      ),
    );
    fetchMock.mockResolvedValue(
      json(404, { error: { code: "NOT_FOUND", message: "User not found", request_id: "r" } }),
    );
    renderButton("cached");

    fireEvent.click(screen.getByRole("button", { name: "Follow bob" }));
    await waitFor(() => expect(getToasts().map((t) => t.message)).toEqual([FOLLOW_ERROR_MESSAGE]));
    expect(await screen.findByRole("button", { name: "Follow bob" })).toBeTruthy();
    expect(client.getQueryData<ProfileViewModel>(queryKeys.profile("bob"))).toMatchObject({
      isFollowing: false,
      followersCount: 3,
    });
  });
});
