// Run: node --test src/frontend/contracts/test/
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  API_ENDPOINTS,
  APP_ROUTES,
  ERROR_CODES,
  ERROR_STATUS,
  INFINITE_QUERY_KEYS,
  LIMITS,
  PAGE_LIMIT,
  SEARCH_LIMIT,
  STALE_TIME_MS,
  UPLOAD_ACCEPT_ATTR,
  buildApiPath,
  errorReactionForStatus,
  isErrorResponseDto,
  isPublicId,
  matchAppRoute,
  normalizeLimit,
  parseServerEvent,
  paths,
  queryKeys,
  resolveGuard,
  safeNextPath,
  toQueryString,
} from "../index.ts";
import type { EndpointKey } from "../index.ts";

const HEX = "0123456789abcdef0123456789abcdef";

describe("ids", () => {
  it("accepts well-formed IDs of the right kind", () => {
    assert.equal(isPublicId("post", `pst_${HEX}`), true);
    assert.equal(isPublicId("user", `usr_${HEX}`), true);
  });
  it("rejects wrong prefix, length, case and type", () => {
    assert.equal(isPublicId("post", `usr_${HEX}`), false);
    assert.equal(isPublicId("post", `pst_${HEX.slice(1)}`), false);
    assert.equal(isPublicId("post", `pst_${HEX}0`), false);
    assert.equal(isPublicId("post", `pst_${HEX.toUpperCase()}`), false);
    assert.equal(isPublicId("post", 42), false);
  });
});

describe("errors", () => {
  it("maps every code to the spec status", () => {
    assert.equal(ERROR_CODES.length, 13);
    assert.equal(ERROR_STATUS.CANNOT_FOLLOW_SELF, 422);
    assert.equal(ERROR_STATUS.INVALID_CREDENTIALS, 401);
  });
  it("recognises valid envelopes with and without details", () => {
    const base = { code: "NOT_FOUND", message: "x", request_id: "r1" };
    assert.equal(isErrorResponseDto({ error: base }), true);
    assert.equal(
      isErrorResponseDto({ error: { ...base, code: "VALIDATION_FAILED", details: [{ path: "caption", message: "m" }] } }),
      true,
    );
  });
  it("rejects malformed envelopes", () => {
    assert.equal(isErrorResponseDto(null), false);
    assert.equal(isErrorResponseDto({ error: { code: "NOPE", message: "x", request_id: "r" } }), false);
    assert.equal(isErrorResponseDto({ error: { code: "INTERNAL", message: "x" } }), false);
    assert.equal(
      isErrorResponseDto({ error: { code: "INTERNAL", message: "x", request_id: "r", details: [{ path: 1 }] } }),
      false,
    );
    assert.equal(isErrorResponseDto({ error: { code: "toString", message: "x", request_id: "r" } }), false);
  });
  it("classifies client reactions", () => {
    assert.equal(errorReactionForStatus(401), "logout");
    assert.equal(errorReactionForStatus(429), "slow_down");
    assert.equal(errorReactionForStatus(404), "inline");
  });
});

describe("pagination & limits", () => {
  it("clamps limits to bounds", () => {
    assert.equal(normalizeLimit(undefined), PAGE_LIMIT.default);
    assert.equal(normalizeLimit(0), 1);
    assert.equal(normalizeLimit(1), 1);
    assert.equal(normalizeLimit(50), 50);
    assert.equal(normalizeLimit(51), 50);
    assert.equal(normalizeLimit(2.5), 20);
    assert.equal(normalizeLimit(99, SEARCH_LIMIT), 30);
  });
  it("matches spec limits", () => {
    assert.equal(LIMITS.captionMax, 2200);
    assert.equal(LIMITS.commentMax, 500);
    assert.equal(LIMITS.postMediaMax, 10);
    assert.equal(UPLOAD_ACCEPT_ATTR, "image/jpeg,image/png,image/webp,video/mp4,video/webm");
  });
});

describe("api routes", () => {
  it("builds parameterised paths with encoding", () => {
    assert.equal(buildApiPath("getPost", { post_id: `pst_${HEX}` }), `/api/v1/posts/pst_${HEX}`);
    assert.equal(buildApiPath("getUser", { username: "a b/c" }), "/api/v1/users/a%20b%2Fc");
    assert.equal(buildApiPath("getFeed", {}, { cursor: undefined, limit: 20 }), "/api/v1/feed?limit=20");
    assert.equal(buildApiPath("searchHashtags", {}, { q: "#cat" }), "/api/v1/search/hashtags?q=%23cat");
  });
  it("throws on missing params", () => {
    assert.throws(() => buildApiPath("getPost", { post_id: "" }), /post_id/);
    assert.throws(() => buildApiPath("getPost", {} as { post_id: string }), /post_id/);
  });
  it("omits empty query strings", () => {
    assert.equal(toQueryString(), "");
    assert.equal(toQueryString({ a: undefined }), "");
  });
  it("has unique method+path pairs and only multipart for uploadMedia", () => {
    const seen = new Set<string>();
    for (const def of Object.values(API_ENDPOINTS)) {
      const sig = `${def.method} ${def.path}`;
      assert.equal(seen.has(sig), false, sig);
      seen.add(sig);
    }
    const multipart = Object.entries(API_ENDPOINTS).filter(([, d]) => d.body === "multipart").map(([k]) => k);
    assert.deepEqual(multipart, ["uploadMedia"]);
  });
  it("204 endpoints carry no JSON response", () => {
    const noContent = Object.entries(API_ENDPOINTS).filter(([, d]) => d.status === 204).map(([k]) => k).sort();
    assert.deepEqual(noContent, ["deleteComment", "deletePost", "deleteStory", "logout", "markStorySeen"]);
  });
});

describe("app routes", () => {
  it("references only known endpoints", () => {
    for (const r of Object.values(APP_ROUTES)) {
      for (const e of r.endpoints) assert.ok(e in API_ENDPOINTS, e);
    }
  });
  it("round-trips builders through the matcher", () => {
    const cases: [string, string, Record<string, string>][] = [
      [paths.home(), "home", {}],
      [paths.createStory(), "createStory", {}],
      [paths.post(`pst_${HEX}`), "post", { postId: `pst_${HEX}` }],
      [paths.followers("ann"), "followers", { username: "ann" }],
      [paths.hashtag("café"), "hashtag", { tag: "café" }],
      [paths.storyViewer("bob"), "storyViewer", { username: "bob" }],
    ];
    for (const [p, key, params] of cases) assert.deepEqual(matchAppRoute(p), { key, params });
  });
  it("falls back to notFound", () => {
    assert.equal(matchAppRoute("/u/ann/likes").key, "notFound");
    assert.equal(matchAppRoute("/p/%E0%A4%A").key, "notFound");
  });
  it("applies auth guards", () => {
    assert.deepEqual(resolveGuard("required", false, "/p/x?y=1"), { kind: "redirect", to: "/login?next=%2Fp%2Fx%3Fy%3D1" });
    assert.deepEqual(resolveGuard("required", true, "/"), { kind: "allow" });
    assert.deepEqual(resolveGuard("public_only", true, "/login"), { kind: "redirect", to: "/" });
    assert.deepEqual(resolveGuard("optional", false, "/explore"), { kind: "allow" });
  });
  it("sanitises next paths", () => {
    assert.equal(safeNextPath("/p/x"), "/p/x");
    assert.equal(safeNextPath("//evil.com"), "/");
    assert.equal(safeNextPath("/\\evil.com"), "/");
    assert.equal(safeNextPath("https://evil.com"), "/");
    assert.equal(safeNextPath(null), "/");
  });
});

describe("query keys", () => {
  it("produces spec keys and stale times", () => {
    assert.deepEqual(queryKeys.search("users", "an"), ["search", "users", "an"]);
    assert.deepEqual(queryKeys.post("p1"), ["post", "p1"]);
    assert.equal(STALE_TIME_MS.me, 300_000);
    assert.equal(STALE_TIME_MS.unreadCount, Infinity);
    for (const k of INFINITE_QUERY_KEYS) assert.ok(k in queryKeys);
  });
});

describe("server events", () => {
  it("parses valid events", () => {
    const e = parseServerEvent(JSON.stringify({ type: "post.counters", data: { post_id: "p", like_count: 1, comment_count: 0 } }));
    assert.equal(e?.type, "post.counters");
    assert.equal(parseServerEvent('{"type":"notification.unread_count","data":{"unread_count":0}}')?.type, "notification.unread_count");
  });
  it("drops invalid events", () => {
    assert.equal(parseServerEvent("not json"), null);
    assert.equal(parseServerEvent('{"type":"unknown","data":{}}'), null);
    assert.equal(parseServerEvent('{"type":"notification.unread_count","data":{"unread_count":-1}}'), null);
    assert.equal(parseServerEvent('{"type":"notification.created","data":{"id":"n"}}'), null);
  });
});

// Compile-time only: endpoint keys stay in sync with the contract interface.
const _keys: EndpointKey[] = ["getFeed", "eventStream"];
void _keys;
