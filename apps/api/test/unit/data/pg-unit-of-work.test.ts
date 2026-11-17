import { describe, expect, it, vi } from "vitest";

import { InProcessEventBus } from "../../../src/data/db/in-process-event-bus.js";
import { PgUnitOfWork, queryable } from "../../../src/data/db/tx.js";
import type { DomainEvent } from "../../../src/domain/shared/events.js";
import type { PostId, UserId } from "../../../src/domain/shared/ids.js";
import { FakeClient, fakePool } from "./fake-pg.js";

const event: DomainEvent = {
  type: "PostCreated",
  postId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b" as PostId,
  authorId: "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c" as UserId,
  at: new Date(),
};

describe("PgUnitOfWork (F-ICOMM-02)", () => {
  it("commits, then publishes collected events, and returns the result", async () => {
    const client = new FakeClient();
    const publish = vi.fn();
    const uow = new PgUnitOfWork(fakePool(client), { publish });

    const result = await uow.run(async (tx, events) => {
      expect(queryable(fakePool(client), tx)).toBe(client);
      events.add(event);
      expect(publish).not.toHaveBeenCalled();
      return 42;
    });

    expect(result).toBe(42);
    expect(client.queries).toEqual(["BEGIN", "COMMIT"]);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith([event]);
    expect(client.released).toBe(true);
  });

  it("rolled-back unit of work publishes no events and rethrows", async () => {
    const client = new FakeClient();
    const publish = vi.fn();
    const uow = new PgUnitOfWork(fakePool(client), { publish });

    await expect(
      uow.run(async (_tx, events) => {
        events.add(event);
        throw new Error("repo failed");
      }),
    ).rejects.toThrow("repo failed");

    expect(client.queries).toEqual(["BEGIN", "ROLLBACK"]);
    expect(publish).not.toHaveBeenCalled();
    expect(client.released).toBe(true);
    expect(client.releaseArg).toBeUndefined();
  });

  it("a failing COMMIT publishes nothing", async () => {
    const client = new FakeClient();
    client.failOn = /^COMMIT$/;
    const publish = vi.fn();
    const uow = new PgUnitOfWork(fakePool(client), { publish });
    await expect(uow.run(async (_tx, events) => events.add(event))).rejects.toThrow(/COMMIT/);
    expect(publish).not.toHaveBeenCalled();
  });

  it("destroys the connection when ROLLBACK itself fails", async () => {
    const client = new FakeClient();
    client.failOn = /^ROLLBACK$/;
    const uow = new PgUnitOfWork(fakePool(client), { publish: vi.fn() });
    await expect(uow.run(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(client.releaseArg).toBeInstanceOf(Error);
  });

  it("does not call publish when nothing was collected", async () => {
    const publish = vi.fn();
    await new PgUnitOfWork(fakePool(new FakeClient()), { publish }).run(async () => undefined);
    expect(publish).not.toHaveBeenCalled();
  });
});

describe("InProcessEventBus", () => {
  it("fans out asynchronously to every handler; a throwing handler is isolated and logged", async () => {
    const error = vi.fn();
    const bus = new InProcessEventBus({ error });
    const seen: string[] = [];
    bus.subscribe(() => {
      throw new Error("bad handler");
    });
    bus.subscribe(async (e) => {
      seen.push(e.type);
    });

    expect(() => bus.publish([event, event])).not.toThrow();
    expect(seen).toEqual([]); // not synchronous
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual(["PostCreated", "PostCreated"]);
    expect(error).toHaveBeenCalledTimes(2);
    expect(error.mock.calls[0]?.[0]).toMatchObject({ event: "PostCreated" });
  });

  it("unsubscribe stops delivery", async () => {
    const bus = new InProcessEventBus();
    const handler = vi.fn();
    const off = bus.subscribe(handler);
    off();
    bus.publish([event]);
    await new Promise((r) => setTimeout(r, 0));
    expect(handler).not.toHaveBeenCalled();
  });
});
