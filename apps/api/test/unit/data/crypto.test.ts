import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { Argon2PasswordHasher } from "../../../src/data/crypto/argon2-password-hasher.js";
import { hashToken, RandomTokenGenerator } from "../../../src/data/crypto/token-generator.js";
import { UuidV7IdGenerator } from "../../../src/data/crypto/uuidv7-id-generator.js";
import type { PasswordHash } from "../../../src/domain/identity/user.entity.js";
import { isUuid } from "../../../src/domain/shared/ids.js";

describe("RandomTokenGenerator", () => {
  it("returns a 43-char base64url token and its sha256", () => {
    const { raw, hash } = new RandomTokenGenerator().generate();
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toEqual(createHash("sha256").update(raw, "utf8").digest());
    expect(hash).toHaveLength(32);
    expect(hashToken(raw)).toEqual(hash);
  });

  it("never repeats", () => {
    const gen = new RandomTokenGenerator();
    const set = new Set(Array.from({ length: 200 }, () => gen.generate().raw));
    expect(set.size).toBe(200);
  });
});

describe("Argon2PasswordHasher", () => {
  const hasher = new Argon2PasswordHasher({ memoryCost: 1024, timeCost: 1, parallelism: 1 });

  it("hashes with argon2id and verifies", async () => {
    const hash = await hasher.hash("correct horse");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("correct horse");
    await expect(hasher.verify(hash, "correct horse")).resolves.toBe(true);
    await expect(hasher.verify(hash, "wrong horse")).resolves.toBe(false);
  });

  it("returns false for a malformed stored hash", async () => {
    await expect(hasher.verify("not-a-hash" as PasswordHash, "x")).resolves.toBe(false);
  });
});

describe("UuidV7IdGenerator", () => {
  it("produces canonical, version-7, time-ordered UUIDs", () => {
    const gen = new UuidV7IdGenerator();
    const ids = Array.from({ length: 50 }, () => gen.uuidv7());
    for (const id of ids) {
      expect(isUuid(id)).toBe(true);
      expect(id[14]).toBe("7");
    }
    expect([...ids].sort()).toEqual(ids);
  });
});
