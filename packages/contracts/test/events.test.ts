import { describe, expect, it } from "vitest";

import { SERVER_EVENT_TYPES, ServerEvent } from "../src/index.js";

describe("ServerEvent", () => {
  it("parses each event type", () => {
    expect(ServerEvent.parse({ type: "notification.unread_count", data: { unread_count: 3 } }).type).toBe(
      "notification.unread_count",
    );
    expect(
      ServerEvent.parse({
        type: "post.counters",
        data: { post_id: "pst_" + "a".repeat(32), like_count: 1, comment_count: 0 },
      }).type,
    ).toBe("post.counters");
    expect(
      ServerEvent.parse({
        type: "notification.created",
        data: {
          id: "ntf_" + "b".repeat(32),
          type: "follow",
          actor: {
            id: "usr_" + "c".repeat(32),
            username: "bob",
            full_name: "",
            avatar_url: null,
            is_following: true,
          },
          post_id: null,
          post_thumbnail_url: null,
          comment_id: null,
          comment_text: null,
          read_at: null,
          created_at: "2026-11-17T10:00:00.000Z",
        },
      }).type,
    ).toBe("notification.created");
  });

  it("rejects unknown types and bad payloads", () => {
    expect(ServerEvent.safeParse({ type: "post.deleted", data: {} }).success).toBe(false);
    expect(
      ServerEvent.safeParse({ type: "notification.unread_count", data: { unread_count: -1 } }).success,
    ).toBe(false);
  });

  it("lists every union member", () => {
    expect([...SERVER_EVENT_TYPES].sort()).toEqual(
      ["notification.created", "notification.unread_count", "post.counters"].sort(),
    );
  });
});
