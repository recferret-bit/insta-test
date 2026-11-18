import { describe, expect, it } from "vitest";

import {
  Caption,
  type CreatePostInput,
  Post,
  extractHashtags,
} from "../../../src/domain/posts/post.entity.js";
import { DomainError, type ErrorCode } from "../../../src/domain/shared/errors.js";
import type { MediaId, PostId, UserId } from "../../../src/domain/shared/ids.js";
import { DOMAIN_LIMITS } from "../../../src/domain/shared/limits.js";

const now = new Date("2026-11-18T10:00:00.000Z");
const later = new Date("2026-11-18T11:00:00.000Z");
const authorId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a01" as UserId;
const otherId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a02" as UserId;
const postId = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a20" as PostId;
const mediaId = (n: number) => `0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4b${String(n).padStart(2, "0")}` as MediaId;
const mediaIds = (n: number) => Array.from({ length: n }, (_, i) => mediaId(i));

const input: CreatePostInput = {
  id: postId,
  authorId,
  caption: "  Sunset #Beach  ",
  mediaIds: mediaIds(3),
  now,
};

function expectCode(fn: () => unknown, code: ErrorCode, path?: string): void {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe(code);
    if (path) expect((err as DomainError).details).toEqual([expect.objectContaining({ path })]);
    return;
  }
  throw new Error(`expected ${code}`);
}

describe("extractHashtags", () => {
  it("lowercases, dedupes and keeps first-appearance order", () => {
    expect(extractHashtags("#Beach day #sun #BEACH #sun_set #2026")).toEqual([
      "beach",
      "sun",
      "sun_set",
      "2026",
    ]);
  });

  it("supports unicode letters/digits and stops at other characters", () => {
    expect(extractHashtags("#Été #東京 #café-time #a.b")).toEqual(["été", "東京", "café", "a"]);
  });

  it("caps a tag at 64 characters (regex quantifier)", () => {
    expect(extractHashtags(`#${"A".repeat(70)}`)).toEqual(["a".repeat(64)]);
  });

  it("returns [] for captions without tags or with bare '#'", () => {
    expect(extractHashtags("")).toEqual([]);
    expect(extractHashtags("no tags # here ##")).toEqual([]);
  });

  it("skips tags whose lowercase form exceeds 64 code points", () => {
    // 'İ' (U+0130) lowercases to 'i' + U+0307 → 2 code points each.
    expect(extractHashtags(`#${"İ".repeat(40)} #ok`)).toEqual(["ok"]);
  });
});

describe("Caption.parse", () => {
  it("trims and accepts the boundaries (2200 chars, 30 tags)", () => {
    expect(Caption.parse("  hi  ").caption).toBe("hi");
    expect(Caption.parse("x".repeat(DOMAIN_LIMITS.captionMax)).caption).toHaveLength(2200);
    const tags = Array.from({ length: 30 }, (_, i) => `#t${i}`).join(" ");
    expect(Caption.parse(tags).hashtags).toHaveLength(30);
    expect(Caption.parse("").caption).toBe("");
  });

  it("counts code points, not UTF-16 units", () => {
    expect(Caption.parse("😀".repeat(2200)).caption).toHaveLength(4400);
  });

  it("rejects > 2200 chars and > 30 distinct hashtags", () => {
    expectCode(() => Caption.parse("x".repeat(2201)), "VALIDATION_FAILED", "caption");
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
    expectCode(() => Caption.parse(tags), "VALIDATION_FAILED", "caption");
    // Duplicates count once.
    expect(Caption.parse(`${tags.split(" ").slice(0, 30).join(" ")} #T0 #t1`).hashtags).toHaveLength(30);
  });
});

describe("Post.create", () => {
  it("creates a live post with contiguous positions and derived hashtags", () => {
    expect(Post.create(input)).toEqual({
      id: postId,
      authorId,
      caption: "Sunset #Beach",
      media: [
        { mediaId: mediaId(0), position: 0 },
        { mediaId: mediaId(1), position: 1 },
        { mediaId: mediaId(2), position: 2 },
      ],
      hashtags: ["beach"],
      likeCount: 0,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  });

  it("accepts 1 and 10 media; array order = position", () => {
    expect(Post.create({ ...input, mediaIds: mediaIds(1) }).media).toHaveLength(1);
    const ten = Post.create({ ...input, mediaIds: [...mediaIds(10)].reverse() });
    expect(ten.media.map((m) => m.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(ten.media[0]!.mediaId).toBe(mediaId(9));
  });

  it.each<[string, Partial<CreatePostInput>, string]>([
    ["0 media", { mediaIds: [] }, "media_ids"],
    ["11 media", { mediaIds: mediaIds(11) }, "media_ids"],
    ["duplicate media", { mediaIds: [mediaId(1), mediaId(1)] }, "media_ids"],
    ["caption > 2200", { caption: "x".repeat(2201) }, "caption"],
    ["31 hashtags", { caption: Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ") }, "caption"],
  ])("rejects %s with VALIDATION_FAILED", (_label, override, path) => {
    expectCode(() => Post.create({ ...input, ...override }), "VALIDATION_FAILED", path);
  });
});

describe("Post.editCaption / assertCanModify", () => {
  const post = { ...Post.create(input), likeCount: 4, commentCount: 2 };

  it("recomputes hashtags, bumps updatedAt and keeps media/counters", () => {
    const edited = Post.editCaption(post, " New #Tag #tag #other ", later);
    expect(edited).toEqual({
      ...post,
      caption: "New #Tag #tag #other",
      hashtags: ["tag", "other"],
      updatedAt: later,
    });
    expect(post.caption).toBe("Sunset #Beach");
    expect(edited.media).not.toBe(post.media);
    expect(Post.editCaption(post, "", later).hashtags).toEqual([]);
  });

  it("rejects invalid captions", () => {
    expectCode(() => Post.editCaption(post, "x".repeat(2201), later), "VALIDATION_FAILED", "caption");
  });

  it("only the author may modify (INV-10)", () => {
    expect(() => Post.assertCanModify(post, authorId)).not.toThrow();
    expectCode(() => Post.assertCanModify(post, otherId), "FORBIDDEN");
  });
});
