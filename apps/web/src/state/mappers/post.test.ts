import { describe, expect, it } from "vitest";

import { hexId, media, NOW, post } from "../../test/fixtures";
import { toCreatePostDto, toPostVM, tokenizeCaption, toUpdatePostDto, withPostCounters } from "./post";

describe("tokenizeCaption", () => {
  it("splits text, hashtags and mentions", () => {
    expect(tokenizeCaption("Sunset at the #Beach with @bob!")).toEqual([
      { type: "text", text: "Sunset at the " },
      { type: "hashtag", text: "#Beach", tag: "beach", href: "/tags/beach" },
      { type: "text", text: " with " },
      { type: "mention", text: "@bob", username: "bob", href: "/u/bob" },
      { type: "text", text: "!" },
    ]);
  });

  it("supports unicode hashtags and caps them at 64 chars", () => {
    const tokens = tokenizeCaption(`#été #${"a".repeat(70)}`);
    expect(tokens[0]).toMatchObject({ type: "hashtag", tag: "été", href: "/tags/%C3%A9t%C3%A9" });
    expect(tokens[2]).toMatchObject({ type: "hashtag", tag: "a".repeat(64) });
    expect(tokens[3]).toEqual({ type: "text", text: "aaaaaa" });
  });

  it("ignores sigils glued to a word (emails, a#b) and strips trailing dots of mentions", () => {
    expect(tokenizeCaption("mail me@host.com a#b")).toEqual([{ type: "text", text: "mail me@host.com a#b" }]);
    expect(tokenizeCaption("hi @bob.")).toEqual([
      { type: "text", text: "hi " },
      { type: "mention", text: "@bob", username: "bob", href: "/u/bob" },
      { type: "text", text: "." },
    ]);
  });

  it("handles empty and plain captions", () => {
    expect(tokenizeCaption("")).toEqual([]);
    expect(tokenizeCaption("just text")).toEqual([{ type: "text", text: "just text" }]);
    expect(tokenizeCaption("# @")).toEqual([{ type: "text", text: "# @" }]);
  });
});

describe("toPostVM", () => {
  it("derives display fields", () => {
    const vm = toPostVM(post(), { viewerId: hexId("usr", 1), now: NOW });
    expect(vm).toMatchObject({
      path: `/p/${hexId("pst", 1)}`,
      isOwn: true,
      isEdited: false,
      likeCountLabel: "1 like",
      viewCommentsLabel: "",
      createdAtRelative: "3h",
      altText: "Sunset at the #Beach with @bob",
      hasMultipleMedia: false,
    });
    expect(vm.createdAtTitle).toMatch(/2026/);
    expect(vm.author.profilePath).toBe("/u/alice");
    expect(vm.media[0]!.aspectRatio).toBeCloseTo(0.8);
  });

  it("anonymous viewers never own posts; alt text falls back to the author", () => {
    const vm = toPostVM(post({ caption: "   ", media: [media(), media({ id: hexId("med", 2) })] }), {
      viewerId: null,
      now: NOW,
    });
    expect(vm.isOwn).toBe(false);
    expect(vm.altText).toBe("Photo by @alice");
    expect(vm.hasMultipleMedia).toBe(true);
  });

  it("truncates alt text to 100 chars and flags edits", () => {
    const vm = toPostVM(post({ caption: "x".repeat(150), updated_at: "2026-11-17T10:00:00.000Z" }), {
      viewerId: null,
    });
    expect(vm.altText).toBe(`${"x".repeat(100)}…`);
    expect(vm.isEdited).toBe(true);
  });

  it("comment labels", () => {
    expect(toPostVM(post({ comment_count: 1 }), { viewerId: null }).viewCommentsLabel).toBe("View 1 comment");
    expect(toPostVM(post({ comment_count: 1234 }), { viewerId: null }).viewCommentsLabel).toBe(
      "View all 1,234 comments",
    );
  });

  it("withPostCounters recomputes labels and never goes negative", () => {
    const vm = toPostVM(post(), { viewerId: null });
    const liked = withPostCounters(vm, { likeCount: vm.likeCount + 1, viewerHasLiked: true });
    expect(liked).toMatchObject({ likeCount: 2, likeCountLabel: "2 likes", viewerHasLiked: true });
    expect(withPostCounters(vm, { likeCount: -1, commentCount: 3 })).toMatchObject({
      likeCount: 0,
      likeCountLabel: "0 likes",
      viewCommentsLabel: "View all 3 comments",
    });
  });
});

describe("post form mappers", () => {
  it("toCreatePostDto copies ids in order", () => {
    const ids = [hexId("med", 2), hexId("med", 1)];
    const dto = toCreatePostDto("cap", ids);
    expect(dto).toEqual({ caption: "cap", media_ids: ids });
    expect(dto.media_ids).not.toBe(ids);
  });

  it("toUpdatePostDto", () => {
    expect(toUpdatePostDto("new")).toEqual({ caption: "new" });
  });
});
