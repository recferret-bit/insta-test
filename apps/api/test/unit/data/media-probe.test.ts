import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LocalMediaProbe, sniffMediaType } from "../../../src/data/storage/media-probe.js";

/** 1×1 PNG with dimensions 3×2 in its IHDR. */
function png(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4, "latin1");
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16);
  ihdr.writeUInt8(6, 17);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ihdr]);
}

const ftyp = (brand: string) =>
  Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from(`ftyp${brand}`, "latin1"), Buffer.alloc(12)]);
const ebml = (docType: string) =>
  Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x80 | docType.length]),
    Buffer.from(docType, "latin1"),
  ]);

describe("sniffMediaType", () => {
  it.each([
    ["jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]), "image/jpeg", "image"],
    ["png", png(3, 2), "image/png", "image"],
    ["webp", Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1")]), "image/webp", "image"],
    ["mp4 isom", ftyp("isom"), "video/mp4", "video"],
    ["mp4 mp42", ftyp("mp42"), "video/mp4", "video"],
    ["webm", ebml("webm"), "video/webm", "video"],
  ])("%s", (_label, head, mime, kind) => {
    expect(sniffMediaType(head)).toEqual({ mime, kind });
  });

  it.each([
    ["gif", Buffer.from("GIF89a", "latin1")],
    ["quicktime", ftyp("qt  ")],
    ["heic", ftyp("heic")],
    ["matroska", ebml("matroska")],
    ["text", Buffer.from("hello world, definitely not media")],
    ["empty", Buffer.alloc(0)],
    ["riff wav", Buffer.from("RIFF\0\0\0\0WAVEfmt ", "latin1")],
  ])("rejects %s", (_label, head) => {
    expect(sniffMediaType(head)).toBeNull();
  });
});

describe("LocalMediaProbe.imageSize", () => {
  it("reads dimensions from the header; corrupt image → UNSUPPORTED_MEDIA_TYPE", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "probe-"));
    try {
      const ok = path.join(dir, "a.png");
      await writeFile(ok, png(3, 2));
      const probe = new LocalMediaProbe();
      await expect(probe.imageSize(ok)).resolves.toEqual({ width: 3, height: 2 });
      const bad = path.join(dir, "b.png");
      await writeFile(bad, Buffer.from("garbage"));
      await expect(probe.imageSize(bad)).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
