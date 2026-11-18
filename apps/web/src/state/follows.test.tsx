import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureHttp } from "../api/http";
import { hexId, me, profile, userSummary } from "../test/fixtures";
import {
  applyFollowState,
  applyOptimisticFollow,
  fetchFollowListPage,
  FOLLOW_ERROR_MESSAGE,
  flattenFollowList,
  patchUserSummaryData,
  useFollowList,
  useFollowMutation,
  type FollowListPage,
} from "./follows";
import { toMeVM, toProfileVM, toUserSummaryVM, type ProfileViewModel } from "./mappers/user";
import { toUserResultVM } from "./mappers/search";
import { queryKeys } from "./query-keys";
import { createQueryClient } from "./queryClient";
import { clearSession, getSessionToken, setSession } from "./session";
import { clearToasts, getToasts } from "./toast";

const FUTURE = "2099-01-01T00:00:00.000Z";
const VIEWER_ID = hexId("usr", 1);
const BOB_ID = hexId("usr", 2);
const CAROL_ID = hexId("usr", 3);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function errorBody(code: string, message = "nope") {
  return { error: { code, message, request_id: "req_1" } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const bobSummary = (isFollowing: boolean | null = false) =>
  toUserSummaryVM(userSummary({ id: BOB_ID, username: "bob", full_name: "Bob", is_following: isFollowing }));
const bobProfile = (isFollowing = false, followers = 10) =>
  toProfileVM(
    profile({ id: BOB_ID, username: "bob", is_following: isFollowing, followers_count: followers }),
    VIEWER_ID,
  );

describe("pure follow helpers", () => {
  it("applyOptimisticFollow flips state and moves followersCount once", () => {
    const p = bobProfile(false, 999);
    const followed = applyOptimisticFollow(p, true);
    expect(followed).toMatchObject({ isFollowing: true, followersCount: 1000 });
    expect(followed.countsLabel.followers).toBe("1K");
    expect(applyOptimisticFollow(followed, true)).toBe(followed);
    expect(applyOptimisticFollow(followed, false)).toMatchObject({ isFollowing: false, followersCount: 999 });
  });

  it("applyOptimisticFollow never goes below zero", () => {
    expect(applyOptimisticFollow(bobProfile(true, 0), false).followersCount).toBe(0);
  });

  it("applyFollowState takes the server counters", () => {
    const p = bobProfile(false, 10);
    const next = applyFollowState(p, { user_id: BOB_ID, following: true, followers_count: 42 });
    expect(next).toMatchObject({ isFollowing: true, followersCount: 42 });
    expect(applyFollowState(next, { user_id: BOB_ID, following: true, followers_count: 42 })).toBe(next);
  });

  it("patchUserSummaryData handles arrays, pages, infinite data and search results", () => {
    const carol = toUserSummaryVM(userSummary({ id: CAROL_ID, username: "carol" }));
    const arr = [bobSummary(), carol];
    const patchedArr = patchUserSummaryData(arr, BOB_ID, true) as typeof arr;
    expect(patchedArr[0]?.isFollowing).toBe(true);
    expect(patchedArr[1]).toBe(carol);

    const page: FollowListPage = { items: [bobSummary()], nextCursor: null };
    expect((patchUserSummaryData(page, BOB_ID, true) as FollowListPage).items[0]?.isFollowing).toBe(true);

    const infinite = { pages: [page, { items: [carol], nextCursor: null }], pageParams: [undefined, "c"] };
    const patchedInf = patchUserSummaryData(infinite, BOB_ID, true) as typeof infinite;
    expect(patchedInf.pages[0]?.items[0]?.isFollowing).toBe(true);
    expect(patchedInf.pages[1]).toBe(infinite.pages[1]);

    const search = [toUserResultVM(userSummary({ id: BOB_ID, username: "bob", is_following: false }))];
    const patchedSearch = patchUserSummaryData(search, BOB_ID, true) as typeof search;
    expect(patchedSearch[0]?.user.isFollowing).toBe(true);
  });

  it("patchUserSummaryData returns the same reference when nothing changes", () => {
    const arr = [bobSummary(true)];
    expect(patchUserSummaryData(arr, BOB_ID, true)).toBe(arr);
    expect(patchUserSummaryData(arr, CAROL_ID, true)).toBe(arr);
    expect(patchUserSummaryData(null, BOB_ID, true)).toBeNull();
    const notSummary = { id: BOB_ID, caption: "a post" };
    expect(patchUserSummaryData({ items: [notSummary], nextCursor: null }, BOB_ID, true)).toEqual({
      items: [notSummary],
      nextCursor: null,
    });
  });

  it("flattenFollowList concatenates pages and drops duplicates", () => {
    const carol = toUserSummaryVM(userSummary({ id: CAROL_ID, username: "carol" }));
    expect(flattenFollowList(undefined)).toEqual([]);
    const data = {
      pages: [
        { items: [bobSummary(), carol], nextCursor: "x" },
        { items: [carol], nextCursor: null },
      ],
      pageParams: [undefined, "x"],
    };
    expect(flattenFollowList(data).map((u) => u.username)).toEqual(["bob", "carol"]);
  });
});

describe("follow hooks", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: ReturnType<typeof createQueryClient>;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function seedCaches() {
    const viewer = toMeVM(me({ id: VIEWER_ID, username: "alice", following_count: 5 }));
    client.setQueryData(queryKeys.me(), viewer);
    client.setQueryData(queryKeys.profile("alice"), viewer as ProfileViewModel);
    client.setQueryData(queryKeys.profile("bob"), bobProfile(false, 10));
    client.setQueryData(queryKeys.followList("followers", "carol"), {
      pages: [{ items: [bobSummary(false)], nextCursor: null }],
      pageParams: [undefined],
    });
  }

  const bobFollowersCount = () =>
    client.getQueryData<ProfileViewModel>(queryKeys.profile("bob"))?.followersCount;
  const bobIsFollowing = () => client.getQueryData<ProfileViewModel>(queryKeys.profile("bob"))?.isFollowing;
  const viewerFollowing = () => client.getQueryData<ProfileViewModel>(queryKeys.me())?.followingCount;
  const listIsFollowing = () =>
    client.getQueryData<{ pages: FollowListPage[] }>(queryKeys.followList("followers", "carol"))?.pages[0]
      ?.items[0]?.isFollowing;

  beforeEach(() => {
    fetchMock = vi.fn();
    client = createQueryClient();
    configureHttp({
      baseUrl: "http://api.test",
      getToken: getSessionToken,
      validateResponses: true,
      fetch: fetchMock,
    });
    setSession({
      token: "tok",
      expiresAt: FUTURE,
      me: toMeVM(me({ id: VIEWER_ID, username: "alice", following_count: 5 })),
    });
  });

  afterEach(() => {
    clearSession();
    clearToasts();
  });

  it("follow: patches caches optimistically, then reconciles with the server", async () => {
    seedCaches();
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);
    const { result } = renderHook(() => useFollowMutation(), { wrapper });

    act(() => result.current.mutate({ user: { id: BOB_ID, username: "bob" }, follow: true }));
    await waitFor(() => expect(bobIsFollowing()).toBe(true));
    expect(bobFollowersCount()).toBe(11);
    expect(viewerFollowing()).toBe(6);
    expect(client.getQueryData<ProfileViewModel>(queryKeys.profile("alice"))?.followingCount).toBe(6);
    expect(listIsFollowing()).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/v1/users/bob/follow");
    expect(init.method).toBe("PUT");

    response.resolve(json(200, { user_id: BOB_ID, following: true, followers_count: 50 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(bobFollowersCount()).toBe(50);
    expect(bobIsFollowing()).toBe(true);
    expect(getToasts()).toEqual([]);
  });

  it("unfollow sends DELETE and decrements counters", async () => {
    seedCaches();
    client.setQueryData(queryKeys.profile("bob"), bobProfile(true, 10));
    fetchMock.mockResolvedValue(json(200, { user_id: BOB_ID, following: false, followers_count: 9 }));
    const { result } = renderHook(() => useFollowMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ user: { id: BOB_ID, username: "bob" }, follow: false }));
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].method).toBe("DELETE");
    expect(bobIsFollowing()).toBe(false);
    expect(bobFollowersCount()).toBe(9);
    expect(viewerFollowing()).toBe(4);
  });

  it("rolls back every cache and toasts on error", async () => {
    seedCaches();
    fetchMock.mockResolvedValue(json(500, errorBody("INTERNAL")));
    const { result } = renderHook(() => useFollowMutation(), { wrapper });
    act(() => result.current.mutate({ user: { id: BOB_ID, username: "bob" }, follow: true }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(bobIsFollowing()).toBe(false);
    expect(bobFollowersCount()).toBe(10);
    expect(viewerFollowing()).toBe(5);
    expect(listIsFollowing()).toBe(false);
    expect(getToasts().map((t) => [t.message, t.tone])).toEqual([[FOLLOW_ERROR_MESSAGE, "error"]]);
  });

  it("429 rolls back with only the global 'Slow down' toast", async () => {
    seedCaches();
    fetchMock.mockResolvedValue(json(429, errorBody("RATE_LIMITED")));
    const { result } = renderHook(() => useFollowMutation(), { wrapper });
    act(() => result.current.mutate({ user: { id: BOB_ID, username: "bob" }, follow: true }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(bobIsFollowing()).toBe(false);
    expect(getToasts().map((t) => t.message)).toEqual(["Slow down"]);
  });

  it("does not move the viewer's counter when the caches already show the requested state", async () => {
    seedCaches();
    client.setQueryData(queryKeys.profile("bob"), bobProfile(true, 10));
    client.removeQueries({ queryKey: ["followers"] });
    fetchMock.mockResolvedValue(json(200, { user_id: BOB_ID, following: true, followers_count: 10 }));
    const { result } = renderHook(() => useFollowMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ user: { id: BOB_ID, username: "bob" }, follow: true }));
    expect(viewerFollowing()).toBe(5);
    expect(bobFollowersCount()).toBe(10);
  });

  it("invalidates the followee's followers and the viewer's following lists", async () => {
    seedCaches();
    client.setQueryData(queryKeys.followList("followers", "bob"), { pages: [], pageParams: [] });
    client.setQueryData(queryKeys.followList("following", "alice"), { pages: [], pageParams: [] });
    fetchMock.mockResolvedValue(json(200, { user_id: BOB_ID, following: true, followers_count: 11 }));
    const { result } = renderHook(() => useFollowMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ user: { id: BOB_ID, username: "bob" }, follow: true }));
    expect(client.getQueryState(queryKeys.followList("followers", "bob"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.followList("following", "alice"))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.followList("followers", "carol"))?.isInvalidated).toBe(false);
  });

  it("useFollowList pages through the followers list with the cursor", async () => {
    const carol = userSummary({ id: CAROL_ID, username: "carol" });
    fetchMock
      .mockResolvedValueOnce(
        json(200, {
          items: [{ ...userSummary({ id: BOB_ID, username: "bob" }), followed_at: FUTURE }],
          next_cursor: "cur_2",
        }),
      )
      .mockResolvedValueOnce(json(200, { items: [{ ...carol, followed_at: FUTURE }], next_cursor: null }));
    const { result } = renderHook(() => useFollowList("followers", "dave"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.test/api/v1/users/dave/followers");
    await act(() => result.current.fetchNextPage());
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://api.test/api/v1/users/dave/followers?cursor=cur_2");
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(flattenFollowList(result.current.data).map((u) => u.username)).toEqual(["bob", "carol"]);
  });

  it("fetchFollowListPage uses the following endpoint and maps to ViewModels", async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        items: [
          { ...userSummary({ username: "bob", full_name: "", is_following: true }), followed_at: null },
        ],
        next_cursor: null,
      }),
    );
    const page = await fetchFollowListPage("following", "dave", undefined);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.test/api/v1/users/dave/following");
    expect(page).toMatchObject({
      nextCursor: null,
      items: [{ username: "bob", displayName: "bob", isFollowing: true, profilePath: "/u/bob" }],
    });
  });
});
