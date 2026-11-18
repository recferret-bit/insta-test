import { Readable } from "node:stream";

import type { Clock } from "../shared/clock.js";
import { DomainError } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { MediaId } from "../shared/ids.js";
import type { UploadMediaCommand } from "./commands.js";
import { buildStorageKey, MediaAsset, maxBytesFor, type MediaKind } from "./media-asset.entity.js";
import type { MediaProbe, MediaRepository, MediaStorage } from "./ports.js";

/** Bytes buffered from the upload before sniffing (`file-type` convention, backend/02 MediaService). */
export const SNIFF_HEAD_BYTES = 4100;

/**
 * `MediaProbe.imageSize` takes a file path, but the `MediaStorage` port only knows keys; the local
 * adapter (`LocalMediaStorage.resolvePath`) maps one to the other. Recorded as a w01 port gap.
 */
export interface MediaFileLocator {
  resolvePath(key: string): string;
}

export type MediaServiceDeps = {
  media: MediaRepository;
  storage: MediaStorage & MediaFileLocator;
  probe: MediaProbe;
  clock: Clock;
  ids: IdGenerator;
};

type Head = { bytes: Buffer; ended: boolean };

/** Reads at least `n` bytes (or until the stream ends), leaving the rest of the stream unread. */
function readHead(stream: Readable, n: number): Promise<Head> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    const cleanup = () => {
      stream.off("data", onData);
      stream.off("end", onEnd);
      stream.off("error", onError);
    };
    const onData = (chunk: Buffer | string) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      chunks.push(buf);
      length += buf.length;
      if (length >= n) {
        stream.pause();
        cleanup();
        resolve({ bytes: Buffer.concat(chunks), ended: false });
      }
    };
    const onEnd = () => {
      cleanup();
      resolve({ bytes: Buffer.concat(chunks), ended: true });
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    stream.on("data", onData);
    stream.once("end", onEnd);
    stream.once("error", onError);
  });
}

/** The already-read head followed by the untouched remainder of the original stream. */
function rejoin(head: Head, rest: Readable): Readable {
  async function* bytes(): AsyncGenerator<Buffer> {
    if (head.bytes.length > 0) yield head.bytes;
    if (!head.ended) {
      for await (const chunk of rest) yield chunk as Buffer;
    }
  }
  return Readable.from(bytes(), { objectMode: false });
}

function invalid(path: string, message: string): DomainError {
  return new DomainError("VALIDATION_FAILED", message, [{ path, message }]);
}

/** Rules that are knowable before any byte is written (avoids storing a file we will reject). */
function precheck(cmd: UploadMediaCommand, kind: MediaKind): void {
  if (cmd.purpose === "avatar" && kind !== "image") throw invalid("file", "Avatar must be an image");
  if (kind === "video" && cmd.durationMs === undefined) {
    throw invalid("duration_ms", "duration_ms is required for videos");
  }
  if (kind === "image" && cmd.durationMs !== undefined) {
    throw invalid("duration_ms", "duration_ms is only allowed for videos");
  }
}

/** `F-BE-02` — media upload (backend/02-services-and-use-cases.md#mediaservice). */
export class MediaService {
  constructor(private readonly deps: MediaServiceDeps) {}

  /**
   * Sniff the type from the first 4100 bytes (client `Content-Type` is never consulted), stream the file to
   * `<yyyy>/<mm>/<uuid>.<ext>` with the kind's byte limit, probe image dimensions (videos use the declared
   * ones), then insert the `uploaded` row. Any failure after the write removes the file.
   * Errors: `UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`, `VALIDATION_FAILED`.
   */
  async upload(cmd: UploadMediaCommand): Promise<MediaAsset> {
    const { storage, probe, media, clock, ids } = this.deps;
    const head = await readHead(cmd.stream, SNIFF_HEAD_BYTES);
    if (head.bytes.length === 0) throw invalid("file", "File is empty");
    const sniffed = probe.sniff(head.bytes);
    if (!sniffed) {
      cmd.stream.resume();
      throw new DomainError("UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG, WebP, MP4 and WebM files are allowed");
    }
    try {
      precheck(cmd, sniffed.kind);
    } catch (err) {
      cmd.stream.resume();
      throw err;
    }

    const now = clock.now();
    const id = ids.uuidv7() as MediaId;
    const storageKey = buildStorageKey(id, sniffed.mime, now);
    const { byteSize } = await storage.put(storageKey, rejoin(head, cmd.stream), maxBytesFor(sniffed.kind));

    try {
      const dims =
        sniffed.kind === "image"
          ? await probe.imageSize(storage.resolvePath(storageKey))
          : { width: cmd.declaredWidth ?? null, height: cmd.declaredHeight ?? null };
      const asset = MediaAsset.create({
        id,
        ownerId: cmd.ownerId,
        purpose: cmd.purpose,
        mimeType: sniffed.mime,
        storageKey,
        byteSize,
        width: dims.width,
        height: dims.height,
        durationMs: cmd.durationMs ?? null,
        now,
      });
      await media.insert(asset);
      return asset;
    } catch (err) {
      await storage.remove(storageKey).catch(() => undefined);
      throw err;
    }
  }
}
