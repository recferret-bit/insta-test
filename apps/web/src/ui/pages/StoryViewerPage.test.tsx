import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureTestHttp } from "../../state/auth.test-utils";
import { toMeVM } from "../../state/mappers/user";
import { createQueryClient } from "../../state/queryClient";
import { clearSession, setSession } from "../../state/session";
import { hexId, me, media, story, trayItem, userSummary } from "../../test/fixtures";
import { StoryViewerPage } from "./StoryViewerPage";

const FUTURE = "2099-01-01T00:00:00.000Z";
const alice = userSummary();
const bob = userSummary({ id: hexId("usr", 2), username: "bob", full_name: "Bob" });
const cat = userSummary({ id: hexId("usr", 3), username: "cat", full_name: "Cat" });

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const bobStories = [story({ id: hexId("sty", 1), author: bob }), story({ id: hexId("sty", 2), author: bob })];
const catStories = [story({ id: hexId("sty", 3), author: cat })];
const aliceStories = [story({ id: hexId("sty", 4), author: alice, view_count: 3 })];

type Call = { method: string; url: string };

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

let calls: Call[];
let fetchMock: ReturnType<typeof vi.fn>;

function route(url: string, init: RequestInit): Response {
  const method = init.method ?? "GET";
  calls.push({ method, url });
  const path = new URL(url).pathname.replace("/api/v1", "");
  if (path === "/stories/tray")
    return json(200, {
      items: [trayItem({ user: bob, has_unseen: true }), trayItem({ user: cat, has_unseen: true })],
    });
  if (path === "/users/bob/stories") return json(200, { user: bob, stories: bobStories });
  if (path === "/users/cat/stories") return json(200, { user: cat, stories: catStories });
  if (path === "/users/alice/stories") return json(200, { user: alice, stories: aliceStories });
  if (path === "/users/vid/stories")
    return json(200, {
      user: bob,
      stories: [
        story({
          id: hexId("sty", 5),
          author: bob,
          media: media({ kind: "video", purpose: "story", mime_type: "video/mp4", duration_ms: 3000 }),
        }),
        story({ id: hexId("sty", 6), author: bob }),
      ],
    });
  if (path === "/users/ghost/stories")
    return json(404, { error: { code: "NOT_FOUND", message: "Not found", request_id: "r" } });
  if (path.endsWith("/seen") && method === "POST") return new Response(null, { status: 204 });
  if (path.endsWith("/viewers"))
    return json(200, {
      items: [{ user: bob, viewed_at: "2026-11-17T11:30:00.000Z" }],
      next_cursor: null,
    });
  throw new Error(`unexpected ${method} ${url}`);
}

/** Lets fetch promises and TanStack's `setTimeout(0)` batching settle under fake timers. */
async function flush() {
  for (let i = 0; i < 6; i++) await act(() => vi.advanceTimersByTimeAsync(0));
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

async function renderViewer(username: string, from?: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/stories/:username",
        element: (
          <>
            <StoryViewerPage />
            <Where />
          </>
        ),
      },
      { path: "*", element: <Where /> },
    ],
    {
      initialEntries: from ? [from, `/stories/${username}`] : [`/stories/${username}`],
      initialIndex: from ? 1 : 0,
      future: { v7_relativeSplatPath: true },
    },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
  await flush();
}

const fills = () => screen.getAllByTestId("story-progress-fill").map((el) => el.style.width);
const progress = () => screen.getByRole("progressbar").getAttribute("aria-label");
const where = () => screen.getByTestId("where").textContent;
const seenPosts = () => calls.filter((c) => c.method === "POST" && c.url.endsWith("/seen")).map((c) => c.url);

describe("StoryViewerPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    calls = [];
    fetchMock = vi.fn((url: string, init: RequestInit) => Promise.resolve(route(url, init)));
    configureTestHttp(fetchMock as unknown as typeof fetch);
    clearSession();
    setSession({ token: "tok", expiresAt: FUTURE, me: toMeVM(me()) });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fills the segmented progress over 5 s per image and auto-advances", async () => {
    await renderViewer("bob");
    expect(progress()).toBe("Story 1 of 2");
    expect(fills()).toEqual(["0%", "0%"]);
    await advance(2500);
    expect(fills()).toEqual(["50%", "0%"]);
    await advance(2500);
    expect(progress()).toBe("Story 2 of 2");
    expect(fills()).toEqual(["100%", "0%"]);
  });

  it("plays a video for its own duration and pauses it with the story", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    await renderViewer("vid");
    expect(play).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: " " });
    expect(pause).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByLabelText("Story by @bob").tagName).toBe("VIDEO");
    await advance(1500);
    expect(fills()[0]).toBe("50%");
    await advance(1500);
    expect(progress()).toBe("Story 2 of 2");
  });

  it("marks each story seen once when it starts displaying", async () => {
    await renderViewer("bob");
    expect(seenPosts()).toEqual([`http://api.test/api/v1/stories/${hexId("sty", 1)}/seen`]);
    await advance(5000);
    await flush();
    expect(seenPosts()).toHaveLength(2);
    expect(seenPosts()[1]).toContain(hexId("sty", 2));
  });

  it("continues with the next tray user after the last story, then closes at the end", async () => {
    await renderViewer("bob");
    await advance(10_000);
    await flush();
    expect(where()).toBe("/stories/cat");
    expect(screen.getByRole("img", { name: "Story by @cat" })).toBeTruthy();
    await advance(5000);
    await flush();
    expect(where()).toBe("/");
  });

  it("navigates with tap zones and arrow keys; back from the first story goes to the previous user", async () => {
    await renderViewer("bob");
    fireEvent.click(screen.getByRole("button", { name: "Next story" }));
    expect(progress()).toBe("Story 2 of 2");
    fireEvent.click(screen.getByRole("button", { name: "Previous story" }));
    expect(progress()).toBe("Story 1 of 2");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(progress()).toBe("Story 2 of 2");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(progress()).toBe("Story 1 of 2");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await flush();
    expect(where()).toBe("/stories/cat");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await flush();
    expect(where()).toBe("/stories/bob");
  });

  it("restarts the first story when there is no previous user", async () => {
    await renderViewer("bob");
    await advance(2000);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await flush();
    expect(where()).toBe("/stories/bob");
    expect(fills()[0]).toBe("0%");
  });

  it("closing after opening from inside the app goes back there, even after hopping users", async () => {
    await renderViewer("bob", "/explore");
    await advance(10_000);
    await flush();
    expect(where()).toBe("/stories/cat");
    fireEvent.keyDown(window, { key: "Escape" });
    await flush();
    expect(where()).toBe("/explore");
  });

  it("Esc closes the viewer", async () => {
    await renderViewer("bob");
    fireEvent.keyDown(window, { key: "Escape" });
    await flush();
    expect(where()).toBe("/");
  });

  it("space toggles pause; the pause button does too", async () => {
    await renderViewer("bob");
    await advance(1000);
    fireEvent.keyDown(window, { key: " " });
    await advance(10_000);
    expect(progress()).toBe("Story 1 of 2");
    expect(fills()[0]).toBe("20%");
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    fireEvent.keyDown(window, { key: " " });
    await advance(1000);
    expect(fills()[0]).toBe("40%");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await advance(5000);
    expect(fills()[0]).toBe("40%");
  });

  it("holding a tap zone pauses and the release does not navigate; a quick tap does", async () => {
    await renderViewer("bob");
    const nextZone = screen.getByRole("button", { name: "Next story" });
    fireEvent.pointerDown(nextZone);
    await advance(300);
    await advance(10_000);
    expect(progress()).toBe("Story 1 of 2");
    fireEvent.pointerUp(nextZone);
    fireEvent.click(nextZone);
    expect(progress()).toBe("Story 1 of 2");
    await advance(500);
    expect(fills()[0]).not.toBe("0%");
    fireEvent.pointerDown(nextZone);
    await advance(50);
    fireEvent.pointerUp(nextZone);
    fireEvent.click(nextZone);
    expect(progress()).toBe("Story 2 of 2");
  });

  it("shows the author 'Seen by N', opens the viewer list and pauses meanwhile; no seen mark", async () => {
    await renderViewer("alice");
    expect(seenPosts()).toEqual([]);
    await advance(1000);
    fireEvent.click(screen.getByRole("button", { name: /Seen by 3/ }));
    await flush();
    const dialog = screen.getByRole("dialog", { name: "Seen by 3" });
    expect(dialog.textContent).toContain("bob");
    await advance(10_000);
    expect(fills()[0]).toBe("20%");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not show 'Seen by' to other viewers", async () => {
    await renderViewer("bob");
    expect(screen.queryByRole("button", { name: /Seen by/ })).toBeNull();
  });

  it("anonymous viewers play stories without tray or seen requests", async () => {
    clearSession();
    await renderViewer("bob");
    expect(progress()).toBe("Story 1 of 2");
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(["/api/v1/users/bob/stories"]);
  });

  it("shows a message for expired / unknown stories and Esc still closes", async () => {
    await renderViewer("ghost");
    expect(screen.getByRole("heading", { name: "No stories right now" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    await flush();
    expect(where()).toBe("/");
  });
});
