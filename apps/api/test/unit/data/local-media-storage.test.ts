import { mkdtemp, readFile, rm, stat, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isValidStorageKey, LocalMediaStorage } from "../../../src/data/storage/local-media-storage.js";
import { DomainError } from "../../../src/domain/shared/errors.js";

const KEY = "2026/11/0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b.jpg";

describe("LocalMediaStorage", () => {
  let root: string;
  let storage: LocalMediaStorage;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "media-test-"));
    storage = new LocalMediaStorage(root);
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("streams a file to <root>/<yyyy>/<mm>/<uuid>.<ext> and reports its size", async () => {
    const data = Buffer.alloc(10_000, 1);
    await expect(storage.put(KEY, Readable.from([data]), 10_000)).resolves.toEqual({ byteSize: 10_000 });
    expect(await readFile(path.join(root, KEY))).toEqual(data);
  });

  it("aborts past maxBytes with PAYLOAD_TOO_LARGE and leaves no partial file", async () => {
    const chunks = [Buffer.alloc(600, 1), Buffer.alloc(600, 2)];
    const err = await storage.put(KEY, Readable.from(chunks), 1_000).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe("PAYLOAD_TOO_LARGE");
    await expect(stat(path.join(root, KEY))).rejects.toThrow();
    expect(await readdir(path.join(root, "2026/11"))).toEqual([]);
  });

  it("remove is idempotent", async () => {
    await storage.put(KEY, Readable.from([Buffer.from("x")]), 10);
    await storage.remove(KEY);
    await expect(storage.remove(KEY)).resolves.toBeUndefined();
    await expect(stat(path.join(root, KEY))).rejects.toThrow();
  });

  it.each([
    "../etc/passwd",
    "2026/11/../../x.jpg",
    "2026/11/abc.jpg",
    "2026/11/0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b.exe",
    "/abs.jpg",
  ])("rejects unsafe key %j", async (key) => {
    expect(isValidStorageKey(key)).toBe(false);
    await expect(storage.put(key, Readable.from([Buffer.from("x")]), 10)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });
});
