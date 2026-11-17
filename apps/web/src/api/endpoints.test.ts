/**
 * Every typed endpoint hits the method + path from docs/specs/external-communication/02–06.
 * Validation is off here: payload shapes are covered by contract tests; this checks routing only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as auth from "./auth";
import * as comments from "./comments";
import * as events from "./events";
import { configureHttp } from "./http";
import * as notifications from "./notifications";
import * as posts from "./posts";
import * as search from "./search";
import * as stories from "./stories";
import * as users from "./users";

const P = "pst_00000000000000000000000000000001";
const C = "cmt_00000000000000000000000000000001";
const S = "sty_00000000000000000000000000000001";
const N = "ntf_00000000000000000000000000000001";
const M = "med_00000000000000000000000000000001";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })));
  configureHttp({
    baseUrl: "http://api.test",
    getToken: () => "t",
    validateResponses: false,
    fetch: fetchMock,
  });
});

const cases: Array<[string, () => Promise<unknown>, string, string, unknown?]> = [
  [
    "signup",
    () => auth.signup({ username: "a", email: "a@b.c", password: "x" }),
    "POST",
    "/auth/signup",
    { username: "a", email: "a@b.c", password: "x" },
  ],
  [
    "login",
    () => auth.login({ login: "a", password: "x" }),
    "POST",
    "/auth/login",
    { login: "a", password: "x" },
  ],
  ["logout", () => auth.logout(), "POST", "/auth/logout"],
  ["getMe", () => users.getMe(), "GET", "/me"],
  ["updateMe", () => users.updateMe({ bio: "hi" }), "PATCH", "/me", { bio: "hi" }],
  ["getUserProfile", () => users.getUserProfile("Al.ice"), "GET", "/users/Al.ice"],
  ["followUser", () => users.followUser("bob"), "PUT", "/users/bob/follow"],
  ["unfollowUser", () => users.unfollowUser("bob"), "DELETE", "/users/bob/follow"],
  [
    "getFollowers",
    () => users.getFollowers("bob", { cursor: "c1", limit: 5 }),
    "GET",
    "/users/bob/followers?cursor=c1&limit=5",
  ],
  ["getFollowing", () => users.getFollowing("bob"), "GET", "/users/bob/following"],
  ["createPost", () => posts.createPost({ media_ids: [M] }), "POST", "/posts", { media_ids: [M] }],
  ["getPost", () => posts.getPost(P), "GET", `/posts/${P}`],
  ["updatePost", () => posts.updatePost(P, { caption: "c" }), "PATCH", `/posts/${P}`, { caption: "c" }],
  ["deletePost", () => posts.deletePost(P), "DELETE", `/posts/${P}`],
  ["getUserPosts", () => posts.getUserPosts("bob", { limit: 12 }), "GET", "/users/bob/posts?limit=12"],
  ["likePost", () => posts.likePost(P), "PUT", `/posts/${P}/like`],
  ["unlikePost", () => posts.unlikePost(P), "DELETE", `/posts/${P}/like`],
  ["getPostLikers", () => posts.getPostLikers(P), "GET", `/posts/${P}/likes`],
  ["getFeed", () => posts.getFeed({ cursor: "abc" }), "GET", "/feed?cursor=abc"],
  ["getExplore", () => posts.getExplore(), "GET", "/explore"],
  ["getComments", () => comments.getComments(P), "GET", `/posts/${P}/comments`],
  [
    "createComment",
    () => comments.createComment(P, { text: "hey" }),
    "POST",
    `/posts/${P}/comments`,
    { text: "hey" },
  ],
  ["deleteComment", () => comments.deleteComment(C), "DELETE", `/comments/${C}`],
  ["createStory", () => stories.createStory({ media_id: M }), "POST", "/stories", { media_id: M }],
  ["deleteStory", () => stories.deleteStory(S), "DELETE", `/stories/${S}`],
  ["getStoryTray", () => stories.getStoryTray(), "GET", "/stories/tray"],
  ["getUserStories", () => stories.getUserStories("bob"), "GET", "/users/bob/stories"],
  ["markStorySeen", () => stories.markStorySeen(S), "POST", `/stories/${S}/seen`],
  ["getStoryViewers", () => stories.getStoryViewers(S), "GET", `/stories/${S}/viewers`],
  ["searchUsers", () => search.searchUsers("@al", 10), "GET", "/search/users?q=%40al&limit=10"],
  ["searchHashtags", () => search.searchHashtags("#sun"), "GET", "/search/hashtags?q=%23sun"],
  ["getHashtagPosts", () => search.getHashtagPosts("été"), "GET", "/hashtags/%C3%A9t%C3%A9/posts"],
  ["getNotifications", () => notifications.getNotifications(), "GET", "/notifications"],
  ["getUnreadCount", () => notifications.getUnreadCount(), "GET", "/notifications/unread-count"],
  [
    "markNotificationsRead",
    () => notifications.markNotificationsRead({ up_to_id: N }),
    "POST",
    "/notifications/read",
    { up_to_id: N },
  ],
  ["createEventTicket", () => events.createEventTicket(), "POST", "/events/ticket"],
];

describe("typed API client endpoints", () => {
  it.each(cases)("%s → %s %s", async (_name, call, method, path, body) => {
    await call();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe(method);
    expect(url).toBe(`http://api.test/api/v1${path}`);
    expect(init?.body).toBe(body === undefined ? undefined : JSON.stringify(body));
  });

  it("encodes path segments", async () => {
    await users.getUserProfile("../me");
    expect(fetchMock.mock.calls[0]![0]).toBe("http://api.test/api/v1/users/..%2Fme");
  });

  it("builds the SSE stream URL with the ticket", () => {
    expect(events.eventStreamUrl("t+k/=")).toBe("http://api.test/api/v1/events/stream?ticket=t%2Bk%2F%3D");
  });
});
