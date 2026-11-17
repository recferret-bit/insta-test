import type { Readable } from "node:stream";

import type { UserId } from "../shared/ids.js";
import type { MediaPurpose } from "./media-asset.entity.js";

export type UploadMediaCommand = {
  ownerId: UserId;
  purpose: MediaPurpose;
  /** File bytes; type is sniffed from the first 4100 bytes, size enforced while streaming. */
  stream: Readable;
  declaredWidth?: number;
  declaredHeight?: number;
  durationMs?: number;
};
