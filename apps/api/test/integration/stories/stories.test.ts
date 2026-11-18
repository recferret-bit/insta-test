import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ErrorResponseDto,
  fromPublicId,
  StoryResponseDto,
  StoryTrayResponseDto,
  StoryViewerPageResponseDto,
  toPublicId,
  UserStoriesResponseDto,
} from "@insta/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { MediaAssetRow } from "../../../src/data/rows/media.row.js";
import { PgStoryRepository } from "../../../src/data/repositories/stories.pg-repository.js";
import { LocalMediaStorage } from "../../../src/data/storage/local-media-storage.js";
import { runJobOnce } from "../../../src/jobs/runner.js";
import { createStoryCleanupJob } from "../../../src/jobs/story-cleanup.job.js";
import {
  buildTestApp,
  closeTestPool,
  createAuthedUser,
  FakeClock,
  getTestPool,
  insertFollow,
  insertMedia,
  insertStory,
  insertStoryView,
  resetDb,
  truncateAll,
  type AuthedUser,
  type TestApp,
} from "../../helpers/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = "2026-11-18T10:00:00.000Z";
const at = (offsetMs: number) => new Date(Date.parse(T0) + offsetMs);

/** `F-ECOMM-08` / `F-BE-06` / `F-BE-09` against real PostgreSQL + a temp `MEDIA_DIR`. */
describe("stories API", () => {
  const pool = getTestPool();
  const clock = new FakeClock(T0);
  let t: TestApp;
  let alice: AuthedUser;
  let bob: AuthedUser;
  let carol: AuthedUser;

  beforeAll(async () => {
    await resetDb(pool);
    t = await buildTestApp({ clock, rateLimit: false });
    await t.app.ready();
  });
  beforeEach(async () => {
    await truncateAll(pool);
    await rm(t.env.MEDIA_DIR, { recursive: true, force: true });
    await mkdir(t.env.MEDIA_DIR, { recursive: true });
    clock.set(T0);
    alice = await createAuthedUser(pool, { user: { username: "alice" } });
    bob = await createAuthedUser(pool, { user: { username: "bob" } });
    carol = await createAuthedUser(pool, { user: { username: "carol" } });
  });
  afterAll(async () => {
    await t.close();
    await closeTestPool();
  });

  const sty = (uuid: string) => toPublicId("sty", uuid);
  const med = (uuid: string) => toPublicId("med", uuid);
  const expectError = (res: { statusCode: number; json(): unknown }, status: number, code: string) => {
    expect(res.statusCode).toBe(status);
    expect(ErrorResponseDto.parse(res.json()).error.code).toBe(code);
  };
  const filePath = (key: string) => path.join(t.env.MEDIA_DIR, key);
  /** A story-purpose upload with its file on disk. */
  async function storyMedia(owner: AuthedUser, over: Partial<MediaAssetRow> = {}): Promise<MediaAssetRow> {
    const m = await insertMedia(pool, {
      owner_id: owner.user.id,
      purpose: "story",
      created_at: at(-1000),
      ...over,
    });
    await mkdir(path.dirname(filePath(m.storage_key)), { recursive: true });
    await writeFile(filePath(m.storage_key), Buffer.from("x"));
    return m;
  }
  /** An active story created `offsetMs` relative to T0 (default 1 h ago), file on disk. */
  async function story(author: AuthedUser, offsetMs = -60 * 60 * 1000) {
    const m = await storyMedia(author, { status: "attached", created_at: at(offsetMs - 1000) });
    return insertStory(pool, { author_id: author.user.id, media_id: m.id, created_at: at(offsetMs) });
  }
  const createStory = (mediaId: string, headers: Record<string, string> = alice.headers) =>
    t.app.inject({ method: "POST", url: "/api/v1/stories", headers, payload: { media_id: mediaId } });
  const get = (url: string, headers: Record<string, string> = {}) =>
    t.app.inject({ method: "GET", url, headers });
  const seen = (id: string, headers: Record<string, string>) =>
    t.app.inject({ method: "POST", url: `/api/v1/stories/${sty(id)}/seen`, headers });
  const del = (id: string, headers: Record<string, string>) =>
    t.app.inject({ method: "DELETE", url: `/api/v1/stories/${sty(id)}`, headers });

  describe("POST /api/v1/stories", () => {
    it("201: expires 24h after the injected clock; media becomes attached; author sees view_count 0", async () => {
      const m = await storyMedia(alice);
      const res = await createStory(med(m.id));
      expect(res.statusCode).toBe(201);
      const dto = StoryResponseDto.parse(res.json());
      expect(dto).toMatchObject({
        created_at: T0,
        expires_at: at(DAY_MS).toISOString(),
        viewer_has_seen: false,
        view_count: 0,
        author: { username: "alice", is_following: null },
        media: { id: med(m.id), purpose: "story", url: `${t.env.PUBLIC_API_URL}/media/${m.storage_key}` },
      });
      const { rows } = await pool.query("SELECT status FROM media_assets WHERE id = $1", [m.id]);
      expect(rows[0].status).toBe("attached");
      const stored = await pool.query("SELECT author_id, media_id FROM stories WHERE id = $1", [
        fromPublicId("sty", dto.id),
      ]);
      expect(stored.rows[0]).toEqual({ author_id: alice.user.id, media_id: m.id });
    });

    it("422 MEDIA_INVALID: post-purpose media, someone else's media, already-attached media, unknown media", async () => {
      const post = await insertMedia(pool, { owner_id: alice.user.id, purpose: "post" });
      const bobs = await storyMedia(bob);
      const used = await storyMedia(alice, { status: "attached" });
      for (const id of [post.id, bobs.id, used.id, "0190a1b2-c3d4-7e5f-8a9b-00000000dead"]) {
        expectError(await createStory(med(id)), 422, "MEDIA_INVALID");
      }
      expect((await pool.query("SELECT count(*)::int AS n FROM stories")).rows[0].n).toBe(0);
    });

    it("the same media cannot back two stories", async () => {
      const m = await storyMedia(alice);
      expect((await createStory(med(m.id))).statusCode).toBe(201);
      expectError(await createStory(med(m.id)), 422, "MEDIA_INVALID");
    });

    it("400 for a malformed media_id / extra fields; 401 anonymous", async () => {
      expectError(await createStory("pst_0190a1b2c3d47e5f8a9baaaaaaaaaaaa"), 400, "VALIDATION_FAILED");
      const extra = await t.app.inject({
        method: "POST",
        url: "/api/v1/stories",
        headers: alice.headers,
        payload: { media_id: med((await storyMedia(alice)).id), caption: "x" },
      });
      expectError(extra, 400, "VALIDATION_FAILED");
      expectError(await createStory(med((await storyMedia(alice)).id), {}), 401, "UNAUTHENTICATED");
    });
  });

  describe("GET /api/v1/users/{username}/stories", () => {
    it("active stories only, created_at ASC; anonymous gets viewer_has_seen false and view_count null", async () => {
      const later = await story(alice, -10 * 60 * 1000);
      const earlier = await story(alice, -5 * 60 * 60 * 1000);
      await story(alice, -DAY_MS - 1); // expired
      await insertStoryView(pool, { story_id: earlier.id, viewer_id: bob.user.id });
      const res = await get("/api/v1/users/ALICE/stories");
      expect(res.statusCode).toBe(200);
      const dto = UserStoriesResponseDto.parse(res.json());
      expect(dto.user.username).toBe("alice");
      expect(dto.stories.map((s) => s.id)).toEqual([sty(earlier.id), sty(later.id)]);
      expect(dto.stories.every((s) => s.viewer_has_seen === false && s.view_count === null)).toBe(true);
    });

    it("viewer flags: follower sees is_following + their own seen state; author sees counts", async () => {
      const s = await story(alice);
      await insertFollow(pool, { follower_id: bob.user.id, followee_id: alice.user.id });
      await insertStoryView(pool, { story_id: s.id, viewer_id: bob.user.id });
      await insertStoryView(pool, { story_id: s.id, viewer_id: carol.user.id });
      const asBob = UserStoriesResponseDto.parse(
        (await get("/api/v1/users/alice/stories", bob.headers)).json(),
      );
      expect(asBob.user.is_following).toBe(true);
      expect(asBob.stories[0]).toMatchObject({ viewer_has_seen: true, view_count: null });
      const asAlice = UserStoriesResponseDto.parse(
        (await get("/api/v1/users/alice/stories", alice.headers)).json(),
      );
      expect(asAlice.user.is_following).toBeNull();
      expect(asAlice.stories[0]).toMatchObject({ viewer_has_seen: false, view_count: 2 });
    });

    it("404 for an unknown user; empty list for a user without stories", async () => {
      expectError(await get("/api/v1/users/nobody/stories"), 404, "NOT_FOUND");
      const dto = UserStoriesResponseDto.parse((await get("/api/v1/users/carol/stories")).json());
      expect(dto.stories).toEqual([]);
    });
  });

  describe("GET /api/v1/stories/tray", () => {
    it("self first, then unseen before seen, then latest first; only followees with active stories", async () => {
      for (const u of [alice, carol])
        await insertFollow(pool, { follower_id: bob.user.id, followee_id: u.user.id });
      const dave = await createAuthedUser(pool, { user: { username: "dave" } });
      await insertFollow(pool, { follower_id: bob.user.id, followee_id: dave.user.id });
      const stranger = await createAuthedUser(pool, { user: { username: "stranger" } });

      await story(bob, -3 * 60 * 60 * 1000); // self
      const a1 = await story(alice, -2 * 60 * 60 * 1000);
      await story(alice, -30 * 60 * 1000); // alice latest, 2 stories, one unseen
      const c1 = await story(carol, -10 * 60 * 1000); // carol latest but fully seen
      await story(dave, -DAY_MS - 5); // only expired → absent
      await story(stranger); // not followed → absent
      await insertStoryView(pool, { story_id: c1.id, viewer_id: bob.user.id });
      await insertStoryView(pool, { story_id: a1.id, viewer_id: bob.user.id });

      const res = await get("/api/v1/stories/tray", bob.headers);
      expect(res.statusCode).toBe(200);
      const { items } = StoryTrayResponseDto.parse(res.json());
      expect(items.map((i) => [i.user.username, i.has_unseen, i.story_count])).toEqual([
        ["bob", false, 1],
        ["alice", true, 2],
        ["carol", false, 1],
      ]);
      expect(items[0]!.user.is_following).toBeNull();
      expect(items[1]!.user.is_following).toBe(true);
      expect(items[1]!.latest_story_at).toBe(at(-30 * 60 * 1000).toISOString());
    });

    it("empty tray; 401 anonymous", async () => {
      expect(
        StoryTrayResponseDto.parse((await get("/api/v1/stories/tray", carol.headers)).json()).items,
      ).toEqual([]);
      expectError(await get("/api/v1/stories/tray"), 401, "UNAUTHENTICATED");
    });
  });

  describe("POST /api/v1/stories/{id}/seen", () => {
    it("204, idempotent (first view time kept); author's own view not recorded", async () => {
      const s = await story(alice);
      expect((await seen(s.id, bob.headers)).statusCode).toBe(204);
      clock.advance(60_000);
      expect((await seen(s.id, bob.headers)).statusCode).toBe(204);
      expect((await seen(s.id, alice.headers)).statusCode).toBe(204);
      const { rows } = await pool.query("SELECT viewer_id, viewed_at FROM story_views WHERE story_id = $1", [
        s.id,
      ]);
      expect(rows).toEqual([{ viewer_id: bob.user.id, viewed_at: new Date(T0) }]);
    });

    it("404 unknown story, 400 malformed id, 401 anonymous", async () => {
      expectError(await seen("0190b000-0000-7000-8000-00000000dead", bob.headers), 404, "NOT_FOUND");
      const bad = await t.app.inject({
        method: "POST",
        url: "/api/v1/stories/pst_123/seen",
        headers: bob.headers,
      });
      expectError(bad, 400, "VALIDATION_FAILED");
      const s = await story(alice);
      expectError(await seen(s.id, {}), 401, "UNAUTHENTICATED");
    });
  });

  describe("GET /api/v1/stories/{id}/viewers", () => {
    it("author gets viewers viewed_at DESC with keyset pagination", async () => {
      const s = await story(alice);
      const viewers = [bob, carol, await createAuthedUser(pool, { user: { username: "dave" } })];
      for (const [i, v] of viewers.entries()) {
        await insertStoryView(pool, {
          story_id: s.id,
          viewer_id: v.user.id,
          viewed_at: at(-50 * 60 * 1000 + i * 1000),
        });
      }
      await insertFollow(pool, { follower_id: alice.user.id, followee_id: carol.user.id });
      const url = `/api/v1/stories/${sty(s.id)}/viewers`;
      const p1 = StoryViewerPageResponseDto.parse((await get(`${url}?limit=2`, alice.headers)).json());
      expect(p1.items.map((i) => i.user.username)).toEqual(["dave", "carol"]);
      expect(p1.items[1]!.user.is_following).toBe(true);
      expect(p1.next_cursor).not.toBeNull();
      const p2 = StoryViewerPageResponseDto.parse(
        (await get(`${url}?limit=2&cursor=${p1.next_cursor}`, alice.headers)).json(),
      );
      expect(p2.items.map((i) => i.user.username)).toEqual(["bob"]);
      expect(p2.next_cursor).toBeNull();
    });

    it("403 for non-authors, 404 unknown, 400 bad cursor", async () => {
      const s = await story(alice);
      expectError(await get(`/api/v1/stories/${sty(s.id)}/viewers`, bob.headers), 403, "FORBIDDEN");
      expectError(
        await get(`/api/v1/stories/${sty("0190b000-0000-7000-8000-00000000dead")}/viewers`, alice.headers),
        404,
        "NOT_FOUND",
      );
      expectError(
        await get(`/api/v1/stories/${sty(s.id)}/viewers?cursor=@@`, alice.headers),
        400,
        "VALIDATION_FAILED",
      );
    });
  });

  describe("DELETE /api/v1/stories/{id}", () => {
    it("author: 204 removes story, views, media row and file", async () => {
      const s = await story(alice);
      await insertStoryView(pool, { story_id: s.id, viewer_id: bob.user.id });
      const { rows } = await pool.query<{ storage_key: string }>(
        "SELECT storage_key FROM media_assets WHERE id = $1",
        [s.media_id],
      );
      const key = rows[0]!.storage_key;
      expect(existsSync(filePath(key))).toBe(true);
      expect((await del(s.id, alice.headers)).statusCode).toBe(204);
      expect((await pool.query("SELECT 1 FROM stories WHERE id = $1", [s.id])).rowCount).toBe(0);
      expect((await pool.query("SELECT 1 FROM story_views WHERE story_id = $1", [s.id])).rowCount).toBe(0);
      expect((await pool.query("SELECT 1 FROM media_assets WHERE id = $1", [s.media_id])).rowCount).toBe(0);
      expect(existsSync(filePath(key))).toBe(false);
      expectError(await del(s.id, alice.headers), 404, "NOT_FOUND");
    });

    it("403 for someone else (story kept); 204 even when the file is already gone", async () => {
      const s = await story(alice);
      expectError(await del(s.id, bob.headers), 403, "FORBIDDEN");
      expect((await pool.query("SELECT 1 FROM stories WHERE id = $1", [s.id])).rowCount).toBe(1);
      await rm(t.env.MEDIA_DIR, { recursive: true, force: true });
      expect((await del(s.id, alice.headers)).statusCode).toBe(204);
    });
  });

  describe("expiry invisibility (INV-06)", () => {
    it("at created_at + 24h the story disappears from every endpoint before cleanup runs", async () => {
      await insertFollow(pool, { follower_id: bob.user.id, followee_id: alice.user.id });
      const m = await storyMedia(alice);
      const created = StoryResponseDto.parse((await createStory(med(m.id))).json());
      const id = fromPublicId("sty", created.id)!;

      clock.set(at(DAY_MS - 1));
      expect(
        UserStoriesResponseDto.parse((await get("/api/v1/users/alice/stories")).json()).stories,
      ).toHaveLength(1);
      expect(
        StoryTrayResponseDto.parse((await get("/api/v1/stories/tray", bob.headers)).json()).items,
      ).toHaveLength(1);

      clock.set(at(DAY_MS)); // exactly expires_at → expired
      expect(UserStoriesResponseDto.parse((await get("/api/v1/users/alice/stories")).json()).stories).toEqual(
        [],
      );
      expect(
        StoryTrayResponseDto.parse((await get("/api/v1/stories/tray", bob.headers)).json()).items,
      ).toEqual([]);
      expect(
        StoryTrayResponseDto.parse((await get("/api/v1/stories/tray", alice.headers)).json()).items,
      ).toEqual([]);
      expectError(await seen(id, bob.headers), 404, "NOT_FOUND");
      expectError(await get(`/api/v1/stories/${created.id}/viewers`, alice.headers), 404, "NOT_FOUND");
      expectError(await del(id, alice.headers), 404, "NOT_FOUND");
      // Row still present: invisibility does not depend on the cleanup job.
      expect((await pool.query("SELECT 1 FROM stories WHERE id = $1", [id])).rowCount).toBe(1);
    });
  });

  describe("StoryCleanupJob (F-BE-09)", () => {
    const logger = { info: () => undefined, error: () => undefined };
    const job = () =>
      createStoryCleanupJob({
        stories: new PgStoryRepository(pool),
        storage: new LocalMediaStorage(t.env.MEDIA_DIR),
        clock,
      });

    it("under the advisory lock: deletes expired stories (+ views, media rows, files), keeps active ones", async () => {
      const expired = await story(alice, -DAY_MS - 60_000);
      await insertStoryView(pool, { story_id: expired.id, viewer_id: bob.user.id });
      const active = await story(alice);
      const { rows } = await pool.query<{ storage_key: string }>(
        "SELECT storage_key FROM media_assets WHERE id = $1",
        [expired.media_id],
      );
      const key = rows[0]!.storage_key;

      expect(await runJobOnce(job(), pool, logger)).toBe("ran");
      expect((await pool.query("SELECT id FROM stories")).rows.map((r) => r.id)).toEqual([active.id]);
      expect(
        (await pool.query("SELECT 1 FROM media_assets WHERE id = $1", [expired.media_id])).rowCount,
      ).toBe(0);
      expect((await pool.query("SELECT 1 FROM media_assets WHERE id = $1", [active.media_id])).rowCount).toBe(
        1,
      );
      expect((await pool.query("SELECT 1 FROM story_views")).rowCount).toBe(0);
      expect(existsSync(filePath(key))).toBe(false);
    });

    it("deleteExpiredBefore honours the batch limit, oldest-expired first", async () => {
      const repo = new PgStoryRepository(pool);
      const oldest = await story(alice, -DAY_MS - 3 * 60_000);
      const middle = await story(alice, -DAY_MS - 2 * 60_000);
      const newest = await story(alice, -DAY_MS - 60_000);
      const first = await repo.deleteExpiredBefore(clock.now(), 2);
      expect(first.map((d) => d.storyId).sort()).toEqual([oldest.id, middle.id].sort());
      const second = await repo.deleteExpiredBefore(clock.now(), 2);
      expect(second.map((d) => d.storyId)).toEqual([newest.id]);
      expect(await repo.deleteExpiredBefore(clock.now(), 2)).toEqual([]);
    });

    it("is skipped while another session holds the lock", async () => {
      await story(alice, -DAY_MS - 60_000);
      const holder = await pool.connect();
      try {
        await holder.query("SELECT pg_advisory_lock(hashtext('story-cleanup'))");
        expect(await runJobOnce(job(), pool, logger)).toBe("skipped");
        expect((await pool.query("SELECT 1 FROM stories")).rowCount).toBe(1);
      } finally {
        await holder.query("SELECT pg_advisory_unlock(hashtext('story-cleanup'))");
        holder.release();
      }
    });
  });
});
