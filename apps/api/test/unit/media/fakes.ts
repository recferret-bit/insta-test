import { Readable } from "node:stream";

import { sniffMediaType } from "../../../src/data/storage/media-probe.js";
import type { MediaAsset } from "../../../src/domain/media/media-asset.entity.js";
import type { MediaProbe, MediaRepository, MediaStorage } from "../../../src/domain/media/ports.js";
import type { MediaFileLocator } from "../../../src/domain/media/media.service.js";
import { DomainError } from "../../../src/domain/shared/errors.js";
import type { MediaId } from "../../../src/domain/shared/ids.js";
import type { Tx } from "../../../src/domain/shared/unit-of-work.js";

/** In-memory `MediaRepository`; `failInsert` simulates a DB error on insert. */
export class FakeMediaRepo implements MediaRepository {
  rows = new Map<MediaId, MediaAsset>();
  failInsert: Error | null = null;
  /** Queued results for `deleteUnattachedOlderThan` (one array per call). */
  deleteBatches: MediaAsset[][] = [];
  deleteCalls: { cutoff: Date; limit: number }[] = [];

  async insert(m: MediaAsset): Promise<void> {
    if (this.failInsert) throw this.failInsert;
    this.rows.set(m.id, structuredClone(m));
  }

  async findManyForUpdate(ids: MediaId[], _tx: Tx): Promise<MediaAsset[]> {
    return ids.flatMap((id) => (this.rows.has(id) ? [this.rows.get(id)!] : []));
  }

  async markAttached(ids: MediaId[], _tx: Tx): Promise<void> {
    for (const id of ids) {
      const m = this.rows.get(id);
      if (m) m.status = "attached";
    }
  }

  async deleteUnattachedOlderThan(cutoff: Date, limit: number): Promise<MediaAsset[]> {
    this.deleteCalls.push({ cutoff, limit });
    return this.deleteBatches.shift() ?? [];
  }
}

/** In-memory `MediaStorage` that consumes the stream and enforces `maxBytes` like the local adapter. */
export class FakeStorage implements MediaStorage, MediaFileLocator {
  files = new Map<string, Buffer>();
  removed: string[] = [];
  lastMaxBytes: number | null = null;
  failRemove: Set<string> = new Set();

  resolvePath(key: string): string {
    return `/media-root/${key}`;
  }

  async put(key: string, stream: Readable, maxBytes: number): Promise<{ byteSize: number }> {
    this.lastMaxBytes = maxBytes;
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stream) {
      size += (chunk as Buffer).length;
      if (size > maxBytes) {
        stream.destroy();
        throw new DomainError("PAYLOAD_TOO_LARGE", `File exceeds the ${maxBytes}-byte limit`);
      }
      chunks.push(chunk as Buffer);
    }
    this.files.set(key, Buffer.concat(chunks));
    return { byteSize: size };
  }

  async remove(key: string): Promise<void> {
    this.removed.push(key);
    if (this.failRemove.has(key)) throw new Error(`EACCES ${key}`);
    this.files.delete(key);
  }
}

/** Real magic-byte sniffer; `imageSize` returns a configurable result for any path. */
export class FakeProbe implements MediaProbe {
  dims: { width: number; height: number } | Error = { width: 640, height: 480 };
  probedPaths: string[] = [];

  sniff(head: Buffer) {
    return sniffMediaType(head);
  }

  async imageSize(filePath: string): Promise<{ width: number; height: number }> {
    this.probedPaths.push(filePath);
    if (this.dims instanceof Error) throw this.dims;
    return this.dims;
  }
}

export const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
export const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const MP4_HEAD = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom", "latin1")]);
export const WEBM_HEAD = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d,
]);

/** `head` followed by `size - head.length` filler bytes, emitted in `chunkSize` pieces. */
export function fileStream(head: Buffer, size: number, chunkSize = 64 * 1024): Readable {
  const body = Buffer.alloc(Math.max(size, head.length), 0x2a);
  head.copy(body, 0);
  const chunks: Buffer[] = [];
  for (let i = 0; i < body.length; i += chunkSize) chunks.push(body.subarray(i, i + chunkSize));
  return Readable.from(chunks, { objectMode: false });
}
