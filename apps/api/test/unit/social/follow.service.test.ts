import { beforeEach, describe, expect, it } from "vitest";

import type { DomainError } from "../../../src/domain/shared/errors.js";
import { BufferedEventCollector, type DomainEvent } from "../../../src/domain/shared/events.js";
import type { UserId } from "../../../src/domain/shared/ids.js";
import type { Tx, UnitOfWork } from "../../../src/domain/shared/unit-of-work.js";
import { FollowService } from "../../../src/domain/social/follow.service.js";
import { FakeClock } from "../../helpers/clock.js";
import { SeqIds } from "../identity/fakes.js";
import { CountingUsers, FakeFollows, FakeNotifications } from "./fakes.js";

const NOW = "2026-11-18T12:00:00.000Z";
// `bob` sorts before `alice` by id so the lock-order assertion is not trivially "follower first".
const ALICE = "0190a000-0000-7000-8000-0000000000a2" as UserId;
const BOB = "0190a000-0000-7000-8000-0000000000a1" as UserId;

/** Records committed events; a throwing `fn` discards them (like `PgUnitOfWork`). */
class RecordingUow implements UnitOfWork {
  published: DomainEvent[] = [];
  runs = 0;
  async run<T>(fn: (tx: Tx, events: BufferedEventCollector) => Promise<T>): Promise<T> {
    this.runs += 1;
    const collector = new BufferedEventCollector();
    const result = await fn({} as Tx, collector);
    this.published.push(...collector.drain());
    return result;
  }
}

function setup() {
  const users = new CountingUsers();
  const follows = new FakeFollows();
  const notifications = new FakeNotifications();
  const uow = new RecordingUow();
  const service = new FollowService({
    users,
    follows,
    notifications,
    uow,
    clock: new FakeClock(NOW),
    ids: new SeqIds(),
  });
  users.add(ALICE, "alice");
  users.add(BOB, "bob");
  return { service, users, follows, notifications, uow };
}

async function expectCode(p: Promise<unknown>, code: string): Promise<void> {
  const err = (await p.then(
    () => {
      throw new Error(`expected ${code}`);
    },
    (e: unknown) => e,
  )) as DomainError;
  expect(err.code).toBe(code);
}

describe("FollowService.follow", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it("creates the relation, updates both counters and returns the followee state", async () => {
    const state = await ctx.service.follow(ALICE, "bob");
    expect(state).toEqual({ followeeId: BOB, following: true, followersCount: 1 });
    expect(ctx.follows.rows.get(`${ALICE}->${BOB}`)?.createdAt.toISOString()).toBe(NOW);
    expect(ctx.users.rows.get(ALICE)!.stats).toMatchObject({ following: 1, followers: 0 });
    expect(ctx.users.rows.get(BOB)!.stats).toMatchObject({ followers: 1, following: 0 });
  });

  it("adjusts counters in ascending user-id order (deadlock-free mutual follows)", async () => {
    await ctx.service.follow(ALICE, "bob");
    await ctx.service.follow(BOB, "alice");
    expect(ctx.users.counterCalls.map((c) => c.id)).toEqual([BOB, ALICE, BOB, ALICE]);
    expect(ctx.users.counterCalls[0]!.delta).toEqual({ followers: 1 });
    expect(ctx.users.counterCalls[2]!.delta).toEqual({ following: 1 });
  });

  it("creates a follow notification and emits UserFollowed + NotificationCreated", async () => {
    await ctx.service.follow(ALICE, "bob");
    const [n] = [...ctx.notifications.rows.values()];
    expect(n).toMatchObject({ type: "follow", recipientId: BOB, actorId: ALICE, postId: null, readAt: null });
    expect(ctx.uow.published).toEqual([
      { type: "UserFollowed", followerId: ALICE, followeeId: BOB, at: new Date(NOW) },
      { type: "NotificationCreated", notificationId: n!.id, recipientId: BOB },
    ]);
  });

  it("is idempotent: second follow changes nothing and emits nothing", async () => {
    await ctx.service.follow(ALICE, "bob");
    ctx.uow.published = [];
    const calls = ctx.users.counterCalls.length;
    const state = await ctx.service.follow(ALICE, "bob");
    expect(state).toEqual({ followeeId: BOB, following: true, followersCount: 1 });
    expect(ctx.users.counterCalls).toHaveLength(calls);
    expect(ctx.notifications.rows.size).toBe(1);
    expect(ctx.uow.published).toEqual([]);
  });

  it("emits only UserFollowed when the notification already exists (dedupe)", async () => {
    await ctx.service.follow(ALICE, "bob");
    ctx.follows.rows.clear(); // relation gone but notification left behind
    ctx.uow.published = [];
    await ctx.service.follow(ALICE, "bob");
    expect(ctx.uow.published.map((e) => e.type)).toEqual(["UserFollowed"]);
  });

  it("normalises the username (trim + lowercase)", async () => {
    await expect(ctx.service.follow(ALICE, "  BoB ")).resolves.toMatchObject({ followeeId: BOB });
  });

  it("unknown username → NOT_FOUND, nothing written", async () => {
    await expectCode(ctx.service.follow(ALICE, "nobody"), "NOT_FOUND");
    expect(ctx.follows.rows.size).toBe(0);
    expect(ctx.uow.published).toEqual([]);
  });

  it("self follow → CANNOT_FOLLOW_SELF, nothing written", async () => {
    await expectCode(ctx.service.follow(ALICE, "alice"), "CANNOT_FOLLOW_SELF");
    expect(ctx.follows.rows.size).toBe(0);
    expect(ctx.users.counterCalls).toEqual([]);
    expect(ctx.notifications.rows.size).toBe(0);
  });
});

describe("FollowService.unfollow", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(async () => {
    ctx = setup();
    await ctx.service.follow(ALICE, "bob");
    ctx.uow.published = [];
    ctx.users.counterCalls = [];
  });

  it("removes the relation, decrements both counters in id order and deletes the notification", async () => {
    const state = await ctx.service.unfollow(ALICE, "bob");
    expect(state).toEqual({ followeeId: BOB, following: false, followersCount: 0 });
    expect(ctx.follows.rows.size).toBe(0);
    expect(ctx.users.counterCalls).toEqual([
      { id: BOB, delta: { followers: -1 } },
      { id: ALICE, delta: { following: -1 } },
    ]);
    expect(ctx.users.rows.get(ALICE)!.stats.following).toBe(0);
    expect(ctx.notifications.deleted).toEqual([{ type: "follow", actorId: ALICE, recipientId: BOB }]);
    expect(ctx.notifications.rows.size).toBe(0);
    expect(ctx.uow.published).toEqual([]);
  });

  it("is idempotent when not following", async () => {
    await ctx.service.unfollow(ALICE, "bob");
    ctx.users.counterCalls = [];
    const state = await ctx.service.unfollow(ALICE, "bob");
    expect(state).toEqual({ followeeId: BOB, following: false, followersCount: 0 });
    expect(ctx.users.counterCalls).toEqual([]);
    expect(ctx.notifications.deleted).toHaveLength(1);
  });

  it("self unfollow is a harmless no-op", async () => {
    const state = await ctx.service.unfollow(ALICE, "alice");
    expect(state).toEqual({ followeeId: ALICE, following: false, followersCount: 0 });
    expect(ctx.users.counterCalls).toEqual([]);
  });

  it("unknown username → NOT_FOUND", async () => {
    await expectCode(ctx.service.unfollow(ALICE, "nobody"), "NOT_FOUND");
  });
});

describe("FollowService lists", () => {
  it("resolves the username and delegates with viewer + page", async () => {
    const ctx = setup();
    const page = { cursor: null, limit: 5 };
    await ctx.service.listFollowers("BOB", ALICE, page);
    await ctx.service.listFollowing("bob", null, page);
    expect(ctx.follows.listCalls).toEqual([
      { side: "followers", userId: BOB, viewerId: ALICE, page },
      { side: "following", userId: BOB, viewerId: null, page },
    ]);
    expect(ctx.uow.runs).toBe(0);
  });

  it("unknown username → NOT_FOUND", async () => {
    const ctx = setup();
    const page = { cursor: null, limit: 5 };
    await expectCode(ctx.service.listFollowers("nobody", null, page), "NOT_FOUND");
    await expectCode(ctx.service.listFollowing("nobody", null, page), "NOT_FOUND");
  });
});
