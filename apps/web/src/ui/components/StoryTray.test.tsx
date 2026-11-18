import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { configureTestHttp } from "../../state/auth.test-utils";
import { toMeVM } from "../../state/mappers/user";
import { createQueryClient } from "../../state/queryClient";
import { clearSession, setSession } from "../../state/session";
import { hexId, me, trayItem, userSummary } from "../../test/fixtures";
import { StoryTray } from "./StoryTray";

const FUTURE = "2099-01-01T00:00:00.000Z";
const alice = userSummary(); // same id/username as `me()`

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderTray(items: unknown[]) {
  const fetchMock = vi.fn(() => Promise.resolve(json(200, { items })));
  configureTestHttp(fetchMock as unknown as typeof fetch);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <StoryTray />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return fetchMock;
}

const linksIn = (nav: HTMLElement) => within(nav).getAllByRole("link");

describe("StoryTray", () => {
  beforeEach(() => {
    clearSession();
    setSession({ token: "tok", expiresAt: FUTURE, me: toMeVM(me()) });
  });

  it("renders nothing when signed out (and does not fetch)", () => {
    clearSession();
    const fetchMock = renderTray([]);
    expect(screen.queryByRole("navigation", { name: "Stories" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows own avatar first with '+' to create a story when self has no story", async () => {
    renderTray([trayItem({ user: userSummary({ id: hexId("usr", 2), username: "bob" }) })]);
    const nav = screen.getByRole("navigation", { name: "Stories" });
    await screen.findByRole("link", { name: /^bob/ });
    const links = linksIn(nav);
    expect(links[0]).toHaveProperty("pathname", "/create/story");
    expect(links[0]!.getAttribute("aria-label")).toBe("Add to your story");
    expect(links[1]!.getAttribute("href")).toBe("/stories/bob");
  });

  it("orders own story first, then unseen (gradient ring), then seen (muted ring)", async () => {
    renderTray([
      trayItem({ user: userSummary({ id: hexId("usr", 2), username: "bob" }), has_unseen: false }),
      trayItem({ user: userSummary({ id: hexId("usr", 3), username: "cat" }), has_unseen: true }),
      trayItem({ user: alice, has_unseen: false, story_count: 1 }),
    ]);
    await screen.findByRole("link", { name: /^cat/ });
    const nav = screen.getByRole("navigation", { name: "Stories" });
    const labels = linksIn(nav).map((a) => a.getAttribute("aria-label"));
    expect(labels).toEqual([
      "Your story, 1 story, seen",
      "Add to your story",
      "cat, 2 stories",
      "bob, 2 stories, seen",
    ]);
    const rings = linksIn(nav).map((a) => a.getAttribute("data-ring"));
    expect(rings).toEqual(["seen", null, "unseen", "seen"]);
    expect(linksIn(nav)[0]!.getAttribute("href")).toBe("/stories/alice");
    expect(nav.querySelector('[data-ring="unseen"] .avatar--ring-unseen')).not.toBeNull();
  });
});
