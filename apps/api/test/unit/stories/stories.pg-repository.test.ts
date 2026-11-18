import type pg from "pg";
import { describe, expect, it } from "vitest";

import { toTx } from "../../../src/data/db/tx.js";
import { PgStoryRepository } from "../../../src/data/repositories/stories.pg-repository.js";
import { DomainError } from "../../../src/domain/shared/errors.js";
import type { MediaId, StoryId, UserId } from "../../../src/domain/shared/ids.js";
import type { Story } from "../../../src/domain/stories/story.entity.js";

type Call = { sql: string; params: unknown[] };

/** Records SQL + params on pool and tx client; `respond` decides rows or throws. */
function recorder(respond: (sql: string) => unknown[] = () => []) {
  const calls: Call[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return { rows: respond(sql) };
  };
  const pool = { query } as unknown as pg.Pool;
  const client = { query } as unknown as pg.PoolClient;
  return { calls, pool, tx: toTx(client) };
}

function pgError(code: string, constraint: string): Error {
  return Object.assign(new Error(`pg ${code}`), { code, constraint });
}

const STORY = "0190b000-0000-7000-8000-00000000abcd" as StoryId;
const USER = "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as UserId;
const VIEWER = "0190a1b2-c3d4-7e5f-8a9b-000000000b0b" as UserId;
const MEDIA = "0190a1b2-c3d4-7e5f-8a9b-aaaaaaaaaaaa" as MediaId;
const NOW = new Date("2026-11-18T10:00:00.000Z");
const story: Story = {
  id: STORY,
  authorId: USER,
  mediaId: MEDIA,
  createdAt: NOW,
  expiresAt: new Date("2026-11-19T10:00:00.000Z"),
};

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof DomainError) return err.code;
    throw err;
  }
  throw new Error("expected a DomainError");
}

describe("PgStoryRepository (unit, SQL shape & error translation)", () => {
  it("insert writes the mapped row on the tx client", async () => {
    const r = recorder();
    await new PgStoryRepository(r.pool).insert(story, r.tx);
    expect(r.calls[0]!.sql).toMatch(/INSERT INTO stories/);
    expect(r.calls[0]!.params).toEqual([STORY, USER, MEDIA, story.createdAt, story.expiresAt]);
  });

  it("insert: 23505 on stories_media_id_key → MEDIA_INVALID; other errors pass through", async () => {
    const dup = recorder(() => {
      throw pgError("23505", "stories_media_id_key");
    });
    expect(await codeOf(new PgStoryRepository(dup.pool).insert(story, dup.tx))).toBe("MEDIA_INVALID");
    const other = recorder(() => {
      throw pgError("23503", "stories_author_id_fkey");
    });
    await expect(new PgStoryRepository(other.pool).insert(story, other.tx)).rejects.toThrow("pg 23503");
  });

  it("findActive filters on expires_at > now (INV-06) and maps the row", async () => {
    const r = recorder(() => [
      {
        id: STORY,
        author_id: USER,
        media_id: MEDIA,
        created_at: story.createdAt,
        expires_at: story.expiresAt,
      },
    ]);
    expect(await new PgStoryRepository(r.pool).findActive(STORY, NOW)).toEqual(story);
    expect(r.calls[0]!.sql).toMatch(/expires_at > \$2/);
    expect(r.calls[0]!.params).toEqual([STORY, NOW]);
  });

  it("findActive → null when no row", async () => {
    expect(await new PgStoryRepository(recorder().pool).findActive(STORY, NOW)).toBeNull();
  });

  it("deleteWithMedia deletes via media_assets (cascade) and returns the storage key; missing → NOT_FOUND", async () => {
    const r = recorder(() => [{ storage_key: "2026/11/x.jpg" }]);
    expect(await new PgStoryRepository(r.pool).deleteWithMedia(STORY, r.tx)).toEqual({
      storageKey: "2026/11/x.jpg",
    });
    expect(r.calls[0]!.sql).toMatch(/DELETE FROM media_assets/);
    const empty = recorder();
    expect(await codeOf(new PgStoryRepository(empty.pool).deleteWithMedia(STORY, empty.tx))).toBe(
      "NOT_FOUND",
    );
  });

  it("insertSeenIfAbsent uses ON CONFLICT DO NOTHING; FK violation on the story → NOT_FOUND", async () => {
    const r = recorder();
    await new PgStoryRepository(r.pool).insertSeenIfAbsent({
      storyId: STORY,
      viewerId: VIEWER,
      viewedAt: NOW,
    });
    expect(r.calls[0]!.sql).toMatch(/ON CONFLICT \(story_id, viewer_id\) DO NOTHING/);
    expect(r.calls[0]!.params).toEqual([STORY, VIEWER, NOW]);
    const gone = recorder(() => {
      throw pgError("23503", "story_views_story_id_fkey");
    });
    expect(
      await codeOf(
        new PgStoryRepository(gone.pool).insertSeenIfAbsent({
          storyId: STORY,
          viewerId: VIEWER,
          viewedAt: NOW,
        }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("tray passes viewer, now and the 100-item cap and maps rows", async () => {
    const r = recorder(() => [
      {
        id: USER,
        username: "alice",
        full_name: "Alice",
        avatar_storage_key: null,
        is_following: true,
        has_unseen: true,
        latest_story_at: NOW,
        story_count: 3,
      },
    ]);
    const items = await new PgStoryRepository(r.pool).tray(VIEWER, NOW);
    expect(r.calls[0]!.params).toEqual([VIEWER, NOW, 100]);
    expect(items).toEqual([
      {
        user: {
          id: USER,
          username: "alice",
          fullName: "Alice",
          avatarStorageKey: null,
          viewerIsFollowing: true,
        },
        hasUnseen: true,
        latestStoryAt: NOW,
        storyCount: 3,
      },
    ]);
  });

  it("getView maps the joined row; view_count bigint string → number", async () => {
    const r = recorder(() => [
      {
        id: STORY,
        author_id: USER,
        media_id: MEDIA,
        created_at: story.createdAt,
        expires_at: story.expiresAt,
        author_username: "alice",
        author_full_name: "Alice",
        author_avatar_storage_key: null,
        author_is_following: null,
        media_owner_id: USER,
        media_purpose: "story",
        media_kind: "image",
        media_mime_type: "image/jpeg",
        media_storage_key: "2026/11/m.jpg",
        media_byte_size: "2048",
        media_width: 1080,
        media_height: 1920,
        media_duration_ms: null,
        media_status: "attached",
        media_created_at: NOW,
        viewer_has_seen: false,
        view_count: "4",
      },
    ]);
    const view = await new PgStoryRepository(r.pool).getView(STORY, USER, NOW);
    expect(r.calls[0]!.params).toEqual([USER, NOW, STORY]);
    expect(view).toMatchObject({
      id: STORY,
      author: { id: USER, username: "alice", viewerIsFollowing: null },
      media: { id: MEDIA, byteSize: 2048, storageKey: "2026/11/m.jpg", status: "attached" },
      viewerHasSeen: false,
      viewCount: 4,
    });
  });

  it("listViewers asks for limit + 1 and emits a cursor from the last item only when more exist", async () => {
    const viewerRow = (i: number) => ({
      id: `0190a1b2-c3d4-7e5f-8a9b-00000000000${i}`,
      username: `v${i}`,
      full_name: "",
      avatar_storage_key: null,
      is_following: false,
      viewed_at: new Date(NOW.getTime() - i * 1000),
    });
    const r = recorder(() => [viewerRow(1), viewerRow(2), viewerRow(3)]);
    const repo = new PgStoryRepository(r.pool);
    const page = await repo.listViewers(STORY, { cursor: null, limit: 2 });
    expect(r.calls[0]!.params).toEqual([STORY, null, null, 3]);
    expect(page.items.map((v) => v.user.username)).toEqual(["v1", "v2"]);
    expect(page.nextCursor).toEqual({ t: new Date(NOW.getTime() - 2000), id: viewerRow(2).id });

    const cursor = { t: NOW, id: VIEWER };
    const last = await repo.listViewers(STORY, { cursor, limit: 5 });
    expect(r.calls[1]!.params).toEqual([STORY, NOW, VIEWER, 6]);
    expect(last.nextCursor).toBeNull();
  });

  it("deleteExpiredBefore uses SKIP LOCKED and maps story ids + keys", async () => {
    const r = recorder(() => [{ story_id: STORY, storage_key: "2026/11/x.jpg" }]);
    const out = await new PgStoryRepository(r.pool).deleteExpiredBefore(NOW, 500);
    expect(r.calls[0]!.sql).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(r.calls[0]!.params).toEqual([NOW, 500]);
    expect(out).toEqual([{ storyId: STORY, storageKey: "2026/11/x.jpg" }]);
  });
});
