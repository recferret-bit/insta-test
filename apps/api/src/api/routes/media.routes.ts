import multipart, { type Multipart, type MultipartFile } from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { LIMITS, MEDIA_STORAGE_KEY_PATTERN, MediaResponseDto, UploadMediaFields } from "@insta/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import { DomainError } from "../../domain/shared/errors.js";
import type { RouteDeps } from "../app-services.js";
import { requireAuth } from "../auth.plugin.js";
import { mapMediaToResponseDto, mapUploadMultipartToCommand } from "../mappers/media.dto-mapper.js";
import { RATE_LIMIT_PRESETS } from "../rate-limit.js";
import { API_V1 } from "./index.js";

/** `Content-Type` per served extension (the key pattern allows exactly these). */
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * busboy limits: one file, a few short text parts. `fileSize` sits one byte above the largest kind limit
 * so `MediaStorage.put` (which knows the sniffed kind) reports the precise `PAYLOAD_TOO_LARGE`.
 */
const MULTIPART_LIMITS = {
  files: 1,
  fields: 8,
  parts: 9,
  fieldSize: 1024,
  fileSize: LIMITS.videoBytesMax + 1,
};

function fileRequired(): DomainError {
  return new DomainError("VALIDATION_FAILED", "Request validation failed", [
    { path: "file", message: "Exactly one 'file' part is required" },
  ]);
}

/**
 * Walks the parts in order and returns the first file plus the text parts that preceded it (a repeated
 * name becomes an array, which the schema rejects). Parts after the file are never read, so the result
 * does not depend on how much of the body busboy has already buffered.
 */
async function readUploadParts(
  parts: AsyncIterableIterator<Multipart>,
): Promise<{ file: MultipartFile; fields: Record<string, unknown> }> {
  const fields: Record<string, unknown> = {};
  for await (const part of parts) {
    if (part.type === "file") {
      if (part.fieldname !== "file") {
        part.file.resume();
        throw fileRequired();
      }
      return { file: part, fields };
    }
    const prev = fields[part.fieldname];
    fields[part.fieldname] = prev === undefined ? part.value : [prev, part.value].flat();
  }
  throw fileRequired();
}

/**
 * `media` route module (`F-ECOMM-04`; external-communication/03-media-and-posts-api.md):
 * `POST /api/v1/media` (multipart upload) and `GET /media/{storage_key}` (static, outside `/api/v1`).
 * Multipart text parts (`purpose`, `width`, `height`, `duration_ms`) must precede the `file` part.
 */
export const mediaRoutes: FastifyPluginAsyncZod<RouteDeps> = async (app, { services, urls, mediaDir }) => {
  await app.register(multipart, { limits: MULTIPART_LIMITS });
  await app.register(fastifyStatic, { root: mediaDir, serve: false, decorateReply: true });

  app.post(
    `${API_V1}/media`,
    {
      schema: { response: { 201: MediaResponseDto } },
      config: { auth: "required", rateLimit: RATE_LIMIT_PRESETS.upload },
    },
    async (request, reply) => {
      const ownerId = requireAuth(request).userId;
      const { file, fields } = await readUploadParts(request.parts());
      const parsed = UploadMediaFields.safeParse(fields);
      if (!parsed.success) {
        file.file.resume();
        throw parsed.error;
      }
      const asset = await services.media.upload(mapUploadMultipartToCommand(parsed.data, file.file, ownerId));
      return reply.code(201).send(mapMediaToResponseDto(asset, urls));
    },
  );

  app.get("/media/*", { config: { auth: "none" } }, async (request, reply) => {
    const key = (request.params as { "*": string })["*"];
    if (!MEDIA_STORAGE_KEY_PATTERN.test(key)) throw new DomainError("NOT_FOUND", "Media not found");
    const ext = key.slice(key.lastIndexOf(".") + 1);
    return reply
      .header("content-type", CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream")
      .header("x-content-type-options", "nosniff")
      .sendFile(key, { contentType: false, immutable: true, maxAge: ONE_YEAR_MS, acceptRanges: true });
  });
};
