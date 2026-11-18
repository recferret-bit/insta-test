import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { Transform, type Readable, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { MediaStorage } from "../../domain/media/ports.js";
import { DomainError } from "../../domain/shared/errors.js";

/**
 * Storage keys are `<yyyy>/<mm>/<uuid>.<ext>` (specs/03-domain-and-entity-map.md); anything else is
 * rejected so a key can never escape `MEDIA_DIR` (external-communication/03 media serving).
 */
export const STORAGE_KEY_PATTERN = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm)$/;

export function isValidStorageKey(key: string): boolean {
  return STORAGE_KEY_PATTERN.test(key);
}

class ByteLimitExceeded extends Error {}

/** Counts bytes and fails the pipeline once `maxBytes` is exceeded. */
class ByteLimiter extends Transform {
  bytes = 0;

  constructor(private readonly maxBytes: number) {
    super();
  }

  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: TransformCallback): void {
    this.bytes += chunk.length;
    if (this.bytes > this.maxBytes) {
      cb(new ByteLimitExceeded());
      return;
    }
    cb(null, chunk);
  }
}

/** `MediaStorage` over a local directory (the compose `media` volume at `MEDIA_DIR`). */
export class LocalMediaStorage implements MediaStorage {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  /** Absolute path for a valid key (used by `MediaProbe.imageSize` and static serving). */
  resolvePath(key: string): string {
    if (!isValidStorageKey(key)) {
      throw new DomainError("VALIDATION_FAILED", "Invalid storage key");
    }
    return path.join(this.root, ...key.split("/"));
  }

  /**
   * Streams into a temp file, then renames atomically. Exceeding `maxBytes` aborts the write,
   * removes the partial file and throws `PAYLOAD_TOO_LARGE`.
   */
  async put(key: string, stream: Readable, maxBytes: number): Promise<{ byteSize: number }> {
    const target = this.resolvePath(key);
    await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.part-${randomBytes(6).toString("hex")}`;
    const limiter = new ByteLimiter(maxBytes);
    try {
      await pipeline(stream, limiter, createWriteStream(temp, { flags: "wx" }));
      await rename(temp, target);
    } catch (err) {
      await unlink(temp).catch(() => undefined);
      if (err instanceof ByteLimitExceeded) {
        stream.resume();
        throw new DomainError("PAYLOAD_TOO_LARGE", `File exceeds the ${maxBytes}-byte limit`);
      }
      throw err;
    }
    return { byteSize: limiter.bytes };
  }

  /** Idempotent: a missing file is not an error. */
  async remove(key: string): Promise<void> {
    try {
      await unlink(this.resolvePath(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}
