import { imageSizeFromFile } from "image-size/fromFile";

import type { MediaAsset, MediaKind } from "../../domain/media/media-asset.entity.js";
import type { MediaProbe } from "../../domain/media/ports.js";
import { DomainError } from "../../domain/shared/errors.js";

type Sniffed = { mime: MediaAsset["mimeType"]; kind: MediaKind };

/** Bytes the caller should buffer before calling `sniff` (backend/02 MediaService). */
export const SNIFF_HEAD_BYTES = 4100;

/** File extension used in storage keys for each allowed MIME type. */
export const EXTENSION_BY_MIME: Record<MediaAsset["mimeType"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const EBML_DOCTYPE_ID = Buffer.from([0x42, 0x82]);
/** ISO-BMFF major brands accepted as `video/mp4` (excludes QuickTime, HEIF/AVIF, audio-only M4A, 3GP). */
const MP4_BRANDS = /^(isom|iso[2-9]|mp4[12]|avc1|dash|M4V |M4VH|M4VP|mmp4|MSNV|NDAS|f4v )$/;

function ascii(buf: Buffer, start: number, end: number): string {
  return buf.subarray(start, end).toString("latin1");
}

/**
 * Magic-byte sniffer for exactly the allow-listed types (`image/jpeg|png|webp`, `video/mp4|webm`).
 * The `MediaProbe.sniff` port is synchronous, while `file-type` v21 is async-only, so the
 * signatures are checked here directly; the client `Content-Type` is never consulted.
 */
export function sniffMediaType(head: Buffer): Sniffed | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return { mime: "image/jpeg", kind: "image" };
  }
  if (head.length >= 8 && head.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { mime: "image/png", kind: "image" };
  }
  if (head.length >= 12 && ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12) === "WEBP") {
    return { mime: "image/webp", kind: "image" };
  }
  if (head.length >= 12 && ascii(head, 4, 8) === "ftyp" && MP4_BRANDS.test(ascii(head, 8, 12))) {
    return { mime: "video/mp4", kind: "video" };
  }
  if (head.length >= 4 && head.subarray(0, 4).equals(EBML_MAGIC)) {
    const docTypeAt = head.indexOf(EBML_DOCTYPE_ID, 4);
    if (docTypeAt !== -1 && docTypeAt < 64) {
      // DocType element: id (2 bytes) + 1-byte vint size (0x80 | len) + ascii value.
      const sizeByte = head[docTypeAt + 2] ?? 0;
      const len = sizeByte & 0x7f;
      const value = ascii(head, docTypeAt + 3, docTypeAt + 3 + len);
      if ((sizeByte & 0x80) !== 0 && value === "webm") return { mime: "video/webm", kind: "video" };
    }
  }
  return null;
}

/** `MediaProbe` adapter: magic-byte sniffing + `image-size` header parsing. */
export class LocalMediaProbe implements MediaProbe {
  sniff(head: Buffer): Sniffed | null {
    return sniffMediaType(head);
  }

  /** Throws `UNSUPPORTED_MEDIA_TYPE` when the header cannot be parsed (corrupt image). */
  async imageSize(filePath: string): Promise<{ width: number; height: number }> {
    try {
      const dims = await imageSizeFromFile(filePath);
      if (!dims.width || !dims.height) throw new Error("missing dimensions");
      return { width: dims.width, height: dims.height };
    } catch {
      throw new DomainError("UNSUPPORTED_MEDIA_TYPE", "Could not read image dimensions");
    }
  }
}
