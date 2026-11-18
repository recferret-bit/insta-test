import { describe, expect, it } from "vitest";

import { comment, hexId, NOW } from "../../test/fixtures";
import { toCommentVM, toCreateCommentDto } from "./comment";

describe("comment mappers", () => {
  const postAuthorId = hexId("usr", 1);
  const commenterId = hexId("usr", 2);

  it.each([
    ["the comment author", commenterId, true],
    ["the post author", postAuthorId, true],
    ["another user", hexId("usr", 3), false],
    ["anonymous", null, false],
  ])("canDelete for %s", (_who, viewerId, expected) => {
    expect(toCommentVM(comment(), { viewerId, postAuthorId, now: NOW }).canDelete).toBe(expected);
  });

  it("maps display fields", () => {
    const vm = toCommentVM(comment(), { viewerId: null, postAuthorId: null, now: NOW });
    expect(vm).toMatchObject({ text: "Nice!", createdAtRelative: "30m", postId: hexId("pst", 1) });
    expect(vm.author.username).toBe("bob");
  });

  it("toCreateCommentDto trims", () => {
    expect(toCreateCommentDto("  hi  ")).toEqual({ text: "hi" });
  });
});
