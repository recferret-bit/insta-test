import { existsSync, readdirSync, readFileSync, type Dirent } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { ErrorResponseDto, fromPublicId, MediaResponseDto } from "@insta/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PgUnitOfWork } from "../../../src/data/db/tx.js";
import { PgMediaRepository } from "../../../src/data/repositories/media.pg-repository.js";
import type { MediaAssetRow } from "../../../src/data/rows/media.row.js";
import { LocalMediaStorage } from "../../../src/data/storage/local-media-storage.js";
import { LocalMediaProbe } from "../../../src/data/storage/media-probe.js";
import { MediaService } from "../../../src/domain/media/media.service.js";
import type { MediaId, UserId } from "../../../src/domain/shared/ids.js";
import { createMediaCleanupJob } from "../../../src/jobs/media-cleanup.job.js";
import {
  buildTestApp,
  closeTestPool,
  createAuthedUser,
  FakeClock,
  getTestPool,
  insertMedia,
  resetDb,
  truncateAll,
  type AuthedUser,
  type TestApp,
} from "../../helpers/index.js";
import { jpeg, mp4, multipartBody, png, webm, webp, type Part } from "./multipart.js";

/** `F-ECOMM-04` / `F-BE-02` / `F-BE-09` against real PostgreSQL + a temp `MEDIA_DIR`. */
describe("media API", () => {
  const pool = getTestPool();
  const clock = new FakeClock("2026-11-18T10:00:00.000Z");
  let t: TestApp;
  let alice: AuthedUser;

  beforeAll(async () => {
    await resetDb(pool);
    t = await buildTestApp({ clock, rateLimit: false });
    await t.app.ready();
  });
  beforeEach(async () => {
    await truncateAll(pool);
    await rm(t.env.MEDIA_DIR, { recursive: true, force: true });
    await mkdir(t.env.MEDIA_DIR, { recursive: true });
    clock.set("2026-11-18T10:00:00.000Z");
    alice = await createAuthedUser(pool, { user: { username: "alice" } });
  });
  afterAll(async () => {
    await t.close();
    await closeTestPool();
  });

  const mediaDir = () => t.env.MEDIA_DIR;
  /** Every stored file (relative keys), ignoring empty directories. */
  const storedFiles = (): string[] =>
    existsSync(mediaDir())
      ? (readdirSync(mediaDir(), { recursive: true, withFileTypes: true }) as Dirent[])
          .filter((d) => d.isFile())
          .map((d) => path.relative(mediaDir(), path.join(d.parentPath, d.name)))
      : [];
  const rowCount = async () => Number((await pool.query("SELECT count(*) FROM media_assets")).rows[0].count);

  const upload = (parts: Part[], headers: Record<string, string> = alice.headers) => {
    const body = multipartBody(parts);
    return t.app.inject({
      method: "POST",
      url: "/api/v1/media",
      payload: body.payload,
      headers: { ...headers, ...body.headers },
    });
  };
  const file = (data: Buffer, contentType?: string): Part => ({
    name: "file",
    filename: "x.bin",
    data,
    contentType,
  });
  const expectError = (res: { statusCode: number; json(): unknown }, status: number, code: string) => {
    expect(res.statusCode).toBe(status);
    expect(ErrorResponseDto.parse(res.json()).error.code).toBe(code);
  };

  describe("POST /api/v1/media", () => {
    it("201 PNG: probed dims, row inserted as uploaded, file written under <yyyy>/<mm>/<uuid>.png", async () => {
      const data = png(300, 200, 4096);
      const res = await upload([{ name: "purpose", value: "post" }, file(data)]);
      expect(res.statusCode).toBe(201);
      const dto = MediaResponseDto.parse(res.json());
      const uuid = fromPublicId("med", dto.id)!;
      expect(dto).toMatchObject({
        kind: "image",
        purpose: "post",
        mime_type: "image/png",
        width: 300,
        height: 200,
        duration_ms: null,
        size_bytes: 4096,
        created_at: "2026-11-18T10:00:00.000Z",
        url: `${t.env.PUBLIC_API_URL}/media/2026/11/${uuid}.png`,
      });
      const { rows } = await pool.query<MediaAssetRow>("SELECT * FROM media_assets WHERE id = $1", [uuid]);
      expect(rows[0]).toMatchObject({
        owner_id: alice.user.id,
        status: "uploaded",
        storage_key: `2026/11/${uuid}.png`,
        byte_size: "4096",
      });
      expect(readFileSync(path.join(mediaDir(), "2026", "11", `${uuid}.png`)).equals(data)).toBe(true);
    });

    it("201 JPEG avatar — type comes from magic bytes, not the client Content-Type", async () => {
      const res = await upload([
        { name: "purpose", value: "avatar" },
        file(jpeg(640, 480), "application/pdf"),
      ]);
      expect(res.statusCode).toBe(201);
      expect(MediaResponseDto.parse(res.json())).toMatchObject({
        kind: "image",
        purpose: "avatar",
        mime_type: "image/jpeg",
        width: 640,
        height: 480,
      });
    });

    it("201 WebP", async () => {
      const res = await upload([{ name: "purpose", value: "story" }, file(webp(1080, 1920))]);
      expect(res.statusCode).toBe(201);
      expect(MediaResponseDto.parse(res.json())).toMatchObject({
        mime_type: "image/webp",
        width: 1080,
        height: 1920,
      });
    });

    it.each([
      ["mp4", mp4(), "video/mp4"],
      ["webm", webm(), "video/webm"],
    ])("201 %s video with declared dims and duration", async (_l, data, mime) => {
      const res = await upload([
        { name: "purpose", value: "story" },
        { name: "width", value: "720" },
        { name: "height", value: "1280" },
        { name: "duration_ms", value: "60000" },
        file(data),
      ]);
      expect(res.statusCode).toBe(201);
      expect(MediaResponseDto.parse(res.json())).toMatchObject({
        kind: "video",
        mime_type: mime,
        width: 720,
        height: 1280,
        duration_ms: 60_000,
        size_bytes: data.length,
      });
    });

    it("201 for a 2 MiB image (the 64 KiB JSON body limit does not apply to multipart)", async () => {
      const res = await upload([{ name: "purpose", value: "post" }, file(png(10, 10, 2 * 1024 * 1024))]);
      expect(res.statusCode).toBe(201);
    });

    it("413 PAYLOAD_TOO_LARGE for an image over 10 MiB; no row, no file left behind", async () => {
      const res = await upload([{ name: "purpose", value: "post" }, file(png(10, 10, 10 * 1024 * 1024 + 1))]);
      expectError(res, 413, "PAYLOAD_TOO_LARGE");
      expect(await rowCount()).toBe(0);
      expect(storedFiles()).toEqual([]);
    });

    it.each([
      ["gif", Buffer.from("GIF89a\x01\x00\x01\x00", "latin1")],
      ["text", Buffer.from("just some text, not media")],
    ])("415 UNSUPPORTED_MEDIA_TYPE for %s", async (_l, data) => {
      const res = await upload([{ name: "purpose", value: "post" }, file(data, "image/png")]);
      expectError(res, 415, "UNSUPPORTED_MEDIA_TYPE");
      expect(await rowCount()).toBe(0);
      expect(storedFiles()).toEqual([]);
    });

    it("415 for a corrupt PNG header (dimensions unreadable); the file is removed", async () => {
      const broken = png(10, 10).subarray(0, 12);
      const res = await upload([{ name: "purpose", value: "post" }, file(broken)]);
      expectError(res, 415, "UNSUPPORTED_MEDIA_TYPE");
      expect(storedFiles()).toEqual([]);
    });

    it("400 avatar video", async () => {
      const res = await upload([
        { name: "purpose", value: "avatar" },
        { name: "duration_ms", value: "1000" },
        file(mp4()),
      ]);
      expectError(res, 400, "VALIDATION_FAILED");
      expect(storedFiles()).toEqual([]);
    });

    it("400 video without duration_ms (text parts sent after the file are not seen)", async () => {
      const missing = await upload([{ name: "purpose", value: "post" }, file(mp4())]);
      expectError(missing, 400, "VALIDATION_FAILED");
      expect(ErrorResponseDto.parse(missing.json()).error.details?.[0]?.path).toBe("duration_ms");
      const late = await upload([
        { name: "purpose", value: "post" },
        file(mp4()),
        { name: "duration_ms", value: "5" },
      ]);
      expectError(late, 400, "VALIDATION_FAILED");
    });

    it("parts after the first file (e.g. a second file) are ignored: one asset, one stored file", async () => {
      const res = await upload([
        { name: "purpose", value: "post" },
        file(png(4, 4)),
        { name: "purpose", value: "avatar" },
        file(jpeg(2, 2)),
      ]);
      expect(res.statusCode).toBe(201);
      expect(MediaResponseDto.parse(res.json())).toMatchObject({ purpose: "post", mime_type: "image/png" });
      expect(await rowCount()).toBe(1);
      expect(storedFiles()).toHaveLength(1);
    });

    it("400 for a repeated text part", async () => {
      const res = await upload([
        { name: "purpose", value: "post" },
        { name: "purpose", value: "story" },
        file(png(1, 1)),
      ]);
      expectError(res, 400, "VALIDATION_FAILED");
    });

    it.each<[string, Part[]]>([
      ["missing purpose", [file(png(1, 1))]],
      ["unknown purpose", [{ name: "purpose", value: "banner" }, file(png(1, 1))]],
      [
        "unknown field",
        [{ name: "purpose", value: "post" }, { name: "caption", value: "x" }, file(png(1, 1))],
      ],
      [
        "duration out of range",
        [{ name: "purpose", value: "post" }, { name: "duration_ms", value: "60001" }, file(mp4())],
      ],
      [
        "width out of range",
        [{ name: "purpose", value: "post" }, { name: "width", value: "8193" }, file(mp4())],
      ],
      [
        "image with duration",
        [{ name: "purpose", value: "post" }, { name: "duration_ms", value: "5" }, file(png(1, 1))],
      ],
      ["no file part", [{ name: "purpose", value: "post" }]],
      [
        "file under another name",
        [
          { name: "purpose", value: "post" },
          { name: "photo", filename: "a", data: png(1, 1) },
        ],
      ],
      ["empty file", [{ name: "purpose", value: "post" }, file(Buffer.alloc(0))]],
    ])("400 VALIDATION_FAILED: %s", async (_l, parts) => {
      expectError(await upload(parts), 400, "VALIDATION_FAILED");
      expect(await rowCount()).toBe(0);
      expect(storedFiles()).toEqual([]);
    });

    it("400 for a non-multipart JSON body", async () => {
      const res = await t.app.inject({
        method: "POST",
        url: "/api/v1/media",
        payload: { purpose: "post" },
        headers: alice.headers,
      });
      expectError(res, 400, "VALIDATION_FAILED");
    });

    it("401 without a bearer token", async () => {
      expectError(
        await upload([{ name: "purpose", value: "post" }, file(png(1, 1))], {}),
        401,
        "UNAUTHENTICATED",
      );
      expect(await rowCount()).toBe(0);
    });
  });

  describe("GET /media/{storage_key}", () => {
    async function uploaded(data: Buffer, parts: Part[] = [{ name: "purpose", value: "post" }]) {
      const res = await upload([...parts, file(data)]);
      expect(res.statusCode).toBe(201);
      const dto = MediaResponseDto.parse(res.json());
      return new URL(dto.url).pathname;
    }

    it("200 with bytes, Content-Type, immutable cache, ranges and nosniff (no auth needed)", async () => {
      const data = png(3, 2, 1000);
      const url = await uploaded(data);
      const res = await t.app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(200);
      expect(res.rawPayload.equals(data)).toBe(true);
      expect(res.headers["content-type"]).toBe("image/png");
      expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
      expect(res.headers["accept-ranges"]).toBe("bytes");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("206 for a byte range (video seeking) with video/mp4", async () => {
      const data = mp4(4096);
      const url = await uploaded(data, [
        { name: "purpose", value: "post" },
        { name: "duration_ms", value: "1000" },
      ]);
      const res = await t.app.inject({ method: "GET", url, headers: { range: "bytes=0-99" } });
      expect(res.statusCode).toBe(206);
      expect(res.headers["content-type"]).toBe("video/mp4");
      expect(res.headers["content-range"]).toBe("bytes 0-99/4096");
      expect(res.rawPayload.equals(data.subarray(0, 100))).toBe(true);
    });

    it.each([
      "/media/2026/11/0190a1b2-c3d4-7e5f-8a9b-000000000000.jpg",
      "/media/2026/11/0190a1b2-c3d4-7e5f-8a9b-000000000000.gif",
      "/media/2026/11/..%2F..%2F..%2Fetc%2Fpasswd",
      "/media/../package.json",
      "/media/",
    ])("404 NOT_FOUND for %s", async (url) => {
      expectError(await t.app.inject({ method: "GET", url }), 404, "NOT_FOUND");
    });
  });

  describe("MediaService.upload — insert failure", () => {
    it("removes the written file and rethrows when the row cannot be inserted (unknown owner FK)", async () => {
      const storage = new LocalMediaStorage(mediaDir());
      const service = new MediaService({
        media: new PgMediaRepository(pool),
        storage,
        probe: new LocalMediaProbe(),
        clock,
        ids: { uuidv7: () => "0190a1b2-c3d4-7e5f-8a9b-bbbbbbbbbbbb" },
      });
      await expect(
        service.upload({
          ownerId: "0190a1b2-c3d4-7e5f-8a9b-cccccccccccc" as UserId,
          purpose: "post",
          stream: Readable.from([png(5, 5, 512)]),
        }),
      ).rejects.toThrow(/foreign key/);
      expect(storedFiles()).toEqual([]);
      expect(await rowCount()).toBe(0);
    });
  });

  describe("PgMediaRepository", () => {
    const repo = () => new PgMediaRepository(pool);

    it("findManyForUpdate + markAttached inside a transaction", async () => {
      const a = await insertMedia(pool, { owner_id: alice.user.id });
      const b = await insertMedia(pool, { owner_id: alice.user.id, mime_type: "video/webm" });
      const uow = new PgUnitOfWork(pool, { publish: () => undefined });
      const found = await uow.run(async (tx) => {
        const rows = await repo().findManyForUpdate(
          [a.id as MediaId, b.id as MediaId, "0190a1b2-c3d4-7e5f-8a9b-dddddddddddd" as MediaId],
          tx,
        );
        await repo().markAttached([a.id as MediaId], tx);
        return rows;
      });
      expect(found.map((m) => m.id).sort()).toEqual([a.id, b.id].sort());
      expect(found.find((m) => m.id === b.id)).toMatchObject({
        kind: "video",
        mimeType: "video/webm",
        byteSize: 2048,
      });
      const { rows } = await pool.query("SELECT id, status FROM media_assets ORDER BY id");
      expect(Object.fromEntries(rows.map((r) => [r.id, r.status]))).toEqual({
        [a.id]: "attached",
        [b.id]: "uploaded",
      });
    });

    it("markAttached is rolled back with its transaction", async () => {
      const a = await insertMedia(pool, { owner_id: alice.user.id });
      const uow = new PgUnitOfWork(pool, { publish: () => undefined });
      await expect(
        uow.run(async (tx) => {
          await repo().markAttached([a.id as MediaId], tx);
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      expect((await pool.query("SELECT status FROM media_assets")).rows[0].status).toBe("uploaded");
    });
  });

  describe("MediaCleanupJob", () => {
    it("deletes only uploaded rows older than 24 h and removes their files", async () => {
      const now = new Date("2026-11-18T10:00:00.000Z");
      const old = new Date(now.getTime() - 24 * 3600_000 - 1000);
      const recent = new Date(now.getTime() - 23 * 3600_000);
      const stale = await insertMedia(pool, { owner_id: alice.user.id, created_at: old });
      const attached = await insertMedia(pool, {
        owner_id: alice.user.id,
        created_at: old,
        status: "attached",
      });
      const fresh = await insertMedia(pool, { owner_id: alice.user.id, created_at: recent });
      const storage = new LocalMediaStorage(mediaDir());
      for (const m of [stale, attached, fresh]) {
        await mkdir(path.dirname(storage.resolvePath(m.storage_key)), { recursive: true });
        await writeFile(storage.resolvePath(m.storage_key), "x");
      }

      const job = createMediaCleanupJob({ media: new PgMediaRepository(pool), storage, clock });
      expect(await job.run()).toEqual({ deleted: 1 });

      const { rows } = await pool.query<{ id: string }>("SELECT id FROM media_assets ORDER BY id");
      expect(rows.map((r) => r.id).sort()).toEqual([attached.id, fresh.id].sort());
      expect(storedFiles().sort()).toEqual([attached.storage_key, fresh.storage_key].sort());
      expect(await job.run()).toEqual({ deleted: 0 });
    });

    it("works through more than one batch", async () => {
      const old = new Date("2026-11-01T00:00:00.000Z");
      for (let i = 0; i < 3; i++) await insertMedia(pool, { owner_id: alice.user.id, created_at: old });
      const repo = new PgMediaRepository(pool);
      const first = await repo.deleteUnattachedOlderThan(clock.now(), 2);
      expect(first).toHaveLength(2);
      expect(first[0]!.status).toBe("uploaded");
      expect(await repo.deleteUnattachedOlderThan(clock.now(), 2)).toHaveLength(1);
      expect(await rowCount()).toBe(0);
    });
  });
});
