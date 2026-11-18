import { describe, expect, it } from "vitest";

import { ID_PREFIX, fromPublicId, publicId, toPublicId } from "../src/index.js";

const UUID = "0190f3c2-a1b4-7c3e-9d1f-2a3b4c5d6e7f";

describe("public ids", () => {
  it("has the seven spec prefixes", () => {
    expect(ID_PREFIX).toEqual({
      user: "usr",
      session: "ses",
      media: "med",
      post: "pst",
      comment: "cmt",
      story: "sty",
      notification: "ntf",
    });
  });

  it("toPublicId strips dashes and prepends the prefix", () => {
    expect(toPublicId("usr", UUID)).toBe("usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f");
  });

  it("toPublicId lowercases an uppercase UUID", () => {
    expect(toPublicId("pst", UUID.toUpperCase())).toBe("pst_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f");
  });

  it("round-trips every prefix", () => {
    for (const prefix of Object.values(ID_PREFIX)) {
      expect(fromPublicId(prefix, toPublicId(prefix, UUID))).toBe(UUID);
    }
  });

  it("toPublicId throws on a non-UUID", () => {
    expect(() => toPublicId("usr", "not-a-uuid")).toThrow(TypeError);
  });

  it.each([
    ["wrong prefix", "pst_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f"],
    ["too short", "usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7"],
    ["too long", "usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f0"],
    ["uppercase hex", "usr_0190F3C2A1B47C3E9D1F2A3B4C5D6E7F"],
    ["dashed uuid", `usr_${UUID}`],
    ["no prefix", "0190f3c2a1b47c3e9d1f2a3b4c5d6e7f"],
    ["empty", ""],
  ])("fromPublicId rejects %s", (_label, value) => {
    expect(fromPublicId("usr", value)).toBeNull();
  });

  it("publicId schema validates format", () => {
    expect(publicId("med").safeParse("med_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f").success).toBe(true);
    expect(publicId("med").safeParse("usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f").success).toBe(false);
  });
});
