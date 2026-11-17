import { describe, expect, it } from "vitest";

import { userSummary } from "../../test/fixtures";
import { toHashtagResultVM, toSearchQuery, toUserResultVM } from "./search";

describe("search mappers", () => {
  it("user result", () => {
    expect(toUserResultVM(userSummary())).toMatchObject({
      kind: "user",
      href: "/u/alice",
      title: "alice",
      subtitle: "Alice Liddell",
    });
  });

  it("hashtag result", () => {
    expect(toHashtagResultVM({ tag: "sunset", post_count: 1234 })).toEqual({
      kind: "hashtag",
      key: "tag:sunset",
      href: "/tags/sunset",
      title: "#sunset",
      subtitle: "1,234 posts",
      tag: "sunset",
      postCount: 1234,
    });
    expect(toHashtagResultVM({ tag: "x", post_count: 1 }).subtitle).toBe("1 post");
  });

  it("toSearchQuery trims, caps and rejects empty input", () => {
    expect(toSearchQuery("  @al  ", 50)).toBe("@al");
    expect(toSearchQuery("   ", 50)).toBeNull();
    expect(toSearchQuery("abcdef", 3)).toBe("abc");
  });
});
