import { describe, expect, it } from "vitest";

import { ApiError } from "../api/http";
import { hexId, NOW, post } from "../test/fixtures";
import { toPostVM } from "./mappers/post";
import { createQueryClient } from "./queryClient";
import { queryKeys } from "./query-keys";
import {
  captionError,
  captionHashtags,
  captionLength,
  postErrorMessage,
  removePostFromCaches,
  removePostFromData,
  withViewer,
} from "./posts";

const vm = (n: number) => toPostVM(post({ id: hexId("pst", n) }), { viewerId: null, now: NOW });

function apiError(status: number, code: string): ApiError {
  return new ApiError(status, { error: { code, message: "nope", request_id: "r" } } as never);
}

describe("caption checks", () => {
  it("counts code points, not UTF-16 units", () => {
    expect(captionLength("😀😀")).toBe(2);
  });

  it("accepts exactly 2200 characters and rejects 2201", () => {
    expect(captionError("a".repeat(2200))).toBeNull();
    expect(captionError("a".repeat(2201))).toBe("Captions are at most 2,200 characters.");
  });

  it("extracts unique lowercased hashtags in first-appearance order", () => {
    expect(captionHashtags("#Sun and #sea, again #SUN")).toEqual(["sun", "sea"]);
    expect(captionHashtags("no tags here")).toEqual([]);
  });

  it("rejects more than 30 distinct hashtags", () => {
    const tags = (n: number) => Array.from({ length: n }, (_, i) => `#t${i}`).join(" ");
    expect(captionError(tags(30))).toBeNull();
    expect(captionError(tags(31))).toBe("Use at most 30 hashtags.");
  });
});

describe("postErrorMessage", () => {
  it("explains MEDIA_INVALID and falls back to the API message", () => {
    expect(postErrorMessage(apiError(422, "MEDIA_INVALID"))).toMatch(/can't be used anymore/);
    expect(postErrorMessage(apiError(403, "FORBIDDEN"))).toBe("nope");
  });
});

describe("withViewer", () => {
  it("re-derives isOwn for the current viewer and keeps the reference when unchanged", () => {
    const p = vm(1);
    expect(withViewer(p, null)).toBe(p);
    expect(withViewer(p, p.author.id).isOwn).toBe(true);
    expect(withViewer({ ...p, isOwn: true }, hexId("usr", 9)).isOwn).toBe(false);
  });
});

describe("removePostFromData", () => {
  it("removes from infinite data and plain pages; same reference when absent", () => {
    const infinite = {
      pages: [
        { items: [vm(1), vm(2)], nextCursor: "c" },
        { items: [vm(3)], nextCursor: null },
      ],
      pageParams: [undefined, "c"],
    };
    const next = removePostFromData(infinite, hexId("pst", 2)) as typeof infinite;
    expect(next.pages[0]?.items.map((p) => p.id)).toEqual([hexId("pst", 1)]);
    expect(next.pages[1]).toBe(infinite.pages[1]);
    expect(removePostFromData(infinite, hexId("pst", 9))).toBe(infinite);
    const page = { items: [vm(1)], nextCursor: null };
    expect(removePostFromData(page, hexId("pst", 1))).toEqual({ items: [], nextCursor: null });
    expect(removePostFromData(undefined, "x")).toBeUndefined();
  });

  it("removePostFromCaches clears list caches and drops detail + comments queries", () => {
    const client = createQueryClient();
    const id = hexId("pst", 1);
    client.setQueryData(queryKeys.feed(), {
      pages: [{ items: [vm(1), vm(2)], nextCursor: null }],
      pageParams: [undefined],
    });
    client.setQueryData(queryKeys.userPosts("alice"), {
      pages: [{ items: [vm(1)], nextCursor: null }],
      pageParams: [undefined],
    });
    client.setQueryData(queryKeys.post(id), vm(1));
    client.setQueryData(queryKeys.comments(id), { pages: [], pageParams: [] });
    removePostFromCaches(client, id);
    const feed = client.getQueryData<{ pages: Array<{ items: Array<{ id: string }> }> }>(queryKeys.feed());
    expect(feed?.pages[0]?.items.map((p) => p.id)).toEqual([hexId("pst", 2)]);
    const grid = client.getQueryData<{ pages: Array<{ items: unknown[] }> }>(queryKeys.userPosts("alice"));
    expect(grid?.pages[0]?.items).toEqual([]);
    expect(client.getQueryData(queryKeys.post(id))).toBeUndefined();
    expect(client.getQueryData(queryKeys.comments(id))).toBeUndefined();
  });
});
