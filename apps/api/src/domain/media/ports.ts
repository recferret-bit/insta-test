import type { Readable } from "node:stream";

import type { MediaId } from "../shared/ids.js";
import type { Tx } from "../shared/unit-of-work.js";
import type { MediaAsset, MediaKind } from "./media-asset.entity.js";

export interface MediaRepository {
  insert(m: MediaAsset): Promise<void>;
  findManyForUpdate(ids: MediaId[], tx: Tx): Promise<MediaAsset[]>;
  markAttached(ids: MediaId[], tx: Tx): Promise<void>;
  /** Returns deleted rows so their files can be removed. */
  deleteUnattachedOlderThan(cutoff: Date, limit: number): Promise<MediaAsset[]>;
}

/** Local volume adapter (`data/storage/local-media-storage.ts`). */
export interface MediaStorage {
  /** Streams to `MEDIA_DIR/<key>`; aborts with `PAYLOAD_TOO_LARGE` past `maxBytes`. */
  put(key: string, stream: Readable, maxBytes: number): Promise<{ byteSize: number }>;
  remove(key: string): Promise<void>;
}

export interface MediaProbe {
  sniff(head: Buffer): { mime: MediaAsset["mimeType"]; kind: MediaKind } | null;
  imageSize(filePath: string): Promise<{ width: number; height: number }>;
}
