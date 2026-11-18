import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { hexId, NOW, story, trayItem, userSummary } from "../test/fixtures";
import { toStoryTrayItemVM, toStoryVM } from "./mappers/story";
import { queryKeys } from "./query-keys";
import {
  adjacentTrayUsername,
  applyStorySeen,
  checkStoryFile,
  initialStoryIndex,
  orderTray,
  splitTray,
  toUserStoriesVM,
  type UserStoriesViewModel,
} from "./stories";

const me = userSummary({ id: hexId("usr", 9), username: "me" });
const bob = userSummary({ id: hexId("usr", 2), username: "bob" });
const cat = userSummary({ id: hexId("usr", 3), username: "cat" });
const dan = userSummary({ id: hexId("usr", 4), username: "dan" });

const tray = [
  toStoryTrayItemVM(trayItem({ user: bob, has_unseen: false, latest_story_at: "2026-11-17T11:00:00.000Z" })),
  toStoryTrayItemVM(trayItem({ user: cat, has_unseen: true, latest_story_at: "2026-11-17T09:00:00.000Z" })),
  toStoryTrayItemVM(trayItem({ user: me, has_unseen: false, latest_story_at: "2026-11-17T08:00:00.000Z" })),
  toStoryTrayItemVM(trayItem({ user: dan, has_unseen: true, latest_story_at: "2026-11-17T10:00:00.000Z" })),
];

const names = (items: { user: { username: string } }[]) => items.map((i) => i.user.username);

describe("orderTray", () => {
  it("puts self first, then unseen, then most recent", () => {
    expect(names(orderTray(tray, me.id))).toEqual(["me", "dan", "cat", "bob"]);
  });

  it("works for anonymous / no self entry and keeps input order on ties", () => {
    const tied = [
      toStoryTrayItemVM(trayItem({ user: bob, has_unseen: true })),
      toStoryTrayItemVM(trayItem({ user: cat, has_unseen: true })),
    ];
    expect(names(orderTray(tied, null))).toEqual(["bob", "cat"]);
    expect(orderTray([], null)).toEqual([]);
  });
});

describe("splitTray", () => {
  it("separates the own item", () => {
    const { own, others } = splitTray(tray, me.id);
    expect(own?.user.username).toBe("me");
    expect(names(others)).toEqual(["dan", "cat", "bob"]);
  });

  it("returns own = null when self has no active story", () => {
    const { own, others } = splitTray(tray.slice(0, 2), me.id);
    expect(own).toBeNull();
    expect(names(others)).toEqual(["cat", "bob"]);
  });
});

describe("adjacentTrayUsername", () => {
  const ordered = orderTray(tray, me.id);
  it("finds the next and previous user", () => {
    expect(adjacentTrayUsername(ordered, "dan", 1)).toBe("cat");
    expect(adjacentTrayUsername(ordered, "dan", -1)).toBe("me");
  });
  it("returns null at the ends or for users outside the tray", () => {
    expect(adjacentTrayUsername(ordered, "bob", 1)).toBeNull();
    expect(adjacentTrayUsername(ordered, "me", -1)).toBeNull();
    expect(adjacentTrayUsername(ordered, "zed", 1)).toBeNull();
  });
});

describe("initialStoryIndex", () => {
  const vm = (seen: boolean, n: number) =>
    toStoryVM(story({ id: hexId("sty", n), viewer_has_seen: seen }), NOW);
  it("starts at the first unseen story", () => {
    expect(initialStoryIndex([vm(true, 1), vm(false, 2), vm(false, 3)])).toBe(1);
  });
  it("starts at 0 when all are seen or none exist", () => {
    expect(initialStoryIndex([vm(true, 1), vm(true, 2)])).toBe(0);
    expect(initialStoryIndex([])).toBe(0);
  });
});

describe("toUserStoriesVM", () => {
  it("maps the user and every story", () => {
    const vm = toUserStoriesVM(
      { user: bob, stories: [story({ author: bob }), story({ id: hexId("sty", 2), author: bob })] },
      NOW,
    );
    expect(vm.user.profilePath).toBe("/u/bob");
    expect(vm.stories.map((s) => s.id)).toEqual([hexId("sty", 1), hexId("sty", 2)]);
    expect(vm.stories[0]!.durationMs).toBe(5000);
  });
});

describe("applyStorySeen", () => {
  function seed(seen: boolean[]) {
    const client = new QueryClient();
    const data: UserStoriesViewModel = toUserStoriesVM(
      {
        user: bob,
        stories: seen.map((s, i) => story({ id: hexId("sty", i + 1), author: bob, viewer_has_seen: s })),
      },
      NOW,
    );
    client.setQueryData(queryKeys.userStories("bob"), data);
    client.setQueryData(queryKeys.storyTray(), [
      toStoryTrayItemVM(trayItem({ user: bob, has_unseen: true })),
    ]);
    return client;
  }
  const ring = (client: QueryClient) =>
    client.getQueryData<{ ringState: string }[]>(queryKeys.storyTray())![0]!.ringState;
  const seenFlags = (client: QueryClient) =>
    client
      .getQueryData<UserStoriesViewModel>(queryKeys.userStories("bob"))!
      .stories.map((s) => s.viewerHasSeen);

  it("marks the story seen and keeps the ring while other stories are unseen", () => {
    const client = seed([false, false]);
    applyStorySeen(client, "bob", hexId("sty", 1));
    expect(seenFlags(client)).toEqual([true, false]);
    expect(ring(client)).toBe("unseen");
  });

  it("flips the tray ring to seen after the last unseen story", () => {
    const client = seed([true, false]);
    applyStorySeen(client, "bob", hexId("sty", 2));
    expect(ring(client)).toBe("seen");
  });

  it("rolls back both caches", () => {
    const client = seed([true, false]);
    const rollback = applyStorySeen(client, "bob", hexId("sty", 2));
    rollback();
    expect(seenFlags(client)).toEqual([true, false]);
    expect(ring(client)).toBe("unseen");
  });

  it("is a no-op without cached user stories", () => {
    const client = new QueryClient();
    expect(() => applyStorySeen(client, "bob", hexId("sty", 1))()).not.toThrow();
  });
});

describe("checkStoryFile", () => {
  const file = (type: string, size = 1000) => new File([new Uint8Array(size)], "f", { type });

  it("accepts images without probing", async () => {
    const probe = vi.fn();
    expect(await checkStoryFile(file("image/png"), probe)).toBeNull();
    expect(probe).not.toHaveBeenCalled();
  });

  it("rejects unsupported types and empty files", async () => {
    expect(await checkStoryFile(file("image/gif"))).toMatch(/JPEG, PNG or WebP/);
    expect(await checkStoryFile(file("image/png", 0))).toMatch(/empty/);
  });

  it("accepts a 60 s video and rejects 60.001 s", async () => {
    expect(await checkStoryFile(file("video/mp4"), async () => 60_000)).toBeNull();
    expect(await checkStoryFile(file("video/mp4"), async () => 60_001)).toMatch(/60 seconds or shorter/);
  });

  it("lets the server decide when the duration is unknown", async () => {
    expect(await checkStoryFile(file("video/webm"), async () => null)).toBeNull();
  });
});
