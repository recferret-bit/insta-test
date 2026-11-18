import { randomBytes } from "node:crypto";

export type Part =
  { name: string; value: string } | { name: string; filename: string; contentType?: string; data: Buffer };

/** Builds a `multipart/form-data` body for `app.inject` (parts are emitted in the given order). */
export function multipartBody(parts: Part[]): { payload: Buffer; headers: Record<string, string> } {
  const boundary = `----insta${randomBytes(8).toString("hex")}`;
  const chunks: Buffer[] = [];
  for (const part of parts) {
    if ("value" in part) {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`,
        ),
      );
    } else {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
            `Content-Type: ${part.contentType ?? "application/octet-stream"}\r\n\r\n`,
        ),
        part.data,
        Buffer.from("\r\n"),
      );
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

/** Minimal PNG whose IHDR declares `width`×`height`, padded to `size` bytes. */
export function png(width: number, height: number, size = 64): Buffer {
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4, "latin1");
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16);
  ihdr.writeUInt8(6, 17);
  const head = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ihdr]);
  return pad(head, size);
}

/** Baseline JPEG header (APP0 + SOF0) declaring `width`×`height`. */
export function jpeg(width: number, height: number, size = 64): Buffer {
  const app0 = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00,
    0x01, 0x00, 0x00,
  ]);
  const sof = Buffer.from([
    0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  ]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return pad(Buffer.concat([app0, sof, Buffer.from([0xff, 0xd9])]), size);
}

/** Extended WebP (VP8X) header declaring `width`×`height`. */
export function webp(width: number, height: number): Buffer {
  const vp8x = Buffer.alloc(18);
  vp8x.write("VP8X", 0, "latin1");
  vp8x.writeUInt32LE(10, 4);
  vp8x.writeUIntLE(width - 1, 12, 3);
  vp8x.writeUIntLE(height - 1, 15, 3);
  const body = Buffer.concat([Buffer.from("WEBP", "latin1"), vp8x]);
  const riff = Buffer.alloc(8);
  riff.write("RIFF", 0, "latin1");
  riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]);
}

export function mp4(size = 2048): Buffer {
  return pad(
    Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom\0\0\0\0isommp41", "latin1")]),
    size,
  );
}

export function webm(size = 2048): Buffer {
  return pad(
    Buffer.from([
      0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d,
    ]),
    size,
  );
}

function pad(head: Buffer, size: number): Buffer {
  if (size <= head.length) return head;
  return Buffer.concat([head, Buffer.alloc(size - head.length, 0)]);
}
