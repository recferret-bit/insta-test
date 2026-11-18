import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { ROUTER_FUTURE, routes } from "./App";
import { toMeVM } from "./state/mappers/user";
import { createQueryClient } from "./state/queryClient";
import { clearSession, setSession } from "./state/session";
import { me } from "./test/fixtures";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path], future: ROUTER_FUTURE });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
  return router;
}

function signIn() {
  setSession({ token: "tok", expiresAt: "2099-01-01T00:00:00.000Z", me: toMeVM(me()) });
}

const pathOf = (router: ReturnType<typeof renderAt>) =>
  `${router.state.location.pathname}${router.state.location.search}`;

describe("route table & guards (F-FE-01)", () => {
  afterEach(() => clearSession());

  it.each(["/", "/create", "/create/story", "/notifications", "/settings/profile"])(
    "protected %s redirects anonymous users to /login?next=…",
    (path) => {
      const router = renderAt(path);
      const expected = path === "/" ? "/login" : `/login?next=${encodeURIComponent(path)}`;
      expect(pathOf(router)).toBe(expected);
      expect(screen.getByRole("heading", { name: "Log in" })).toBeTruthy();
    },
  );

  it("keeps the query string in next", () => {
    const router = renderAt("/notifications?tab=all");
    expect(pathOf(router)).toBe(`/login?next=${encodeURIComponent("/notifications?tab=all")}`);
  });

  it.each([
    ["/explore", "Explore"],
    ["/search", "Search"],
    ["/tags/sunset", "#sunset"],
    ["/p/pst_00000000000000000000000000000001", "Post"],
    ["/u/alice", "@alice"],
    ["/u/alice/followers", "@alice"],
    ["/u/alice/following", "@alice"],
    ["/stories/alice", "@alice's story"],
    ["/no/such/page", "Page not found"],
  ])("optional/public route %s renders for anonymous users", (path, heading) => {
    const router = renderAt(path);
    expect(router.state.location.pathname).toBe(path);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
  });

  it("renders protected pages inside the shell when signed in", () => {
    signIn();
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Primary mobile" })).toBeTruthy();
    const homeLinks = screen.getAllByRole("link", { name: "Home" });
    expect(homeLinks.every((a) => a.getAttribute("aria-current") === "page")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Profile" })[0]!.getAttribute("href")).toBe("/u/alice");
  });

  it("PublicOnly sends signed-in users to / or to a safe next path", () => {
    signIn();
    expect(pathOf(renderAt("/login"))).toBe("/");
  });

  it("PublicOnly honours a same-origin next and rejects external ones", () => {
    signIn();
    expect(pathOf(renderAt(`/signup?next=${encodeURIComponent("/create")}`))).toBe("/create");
  });

  it("PublicOnly rejects protocol-relative next values", () => {
    signIn();
    expect(pathOf(renderAt(`/login?next=${encodeURIComponent("//evil.example")}`))).toBe("/");
  });

  it("logging out elsewhere sends the user from a protected page to login", () => {
    signIn();
    const router = renderAt("/notifications");
    expect(router.state.location.pathname).toBe("/notifications");
    act(() => clearSession());
    expect(pathOf(router)).toBe(`/login?next=${encodeURIComponent("/notifications")}`);
  });

  it("anonymous shell shows a Log in entry instead of Profile", () => {
    renderAt("/explore");
    expect(screen.getAllByRole("link", { name: "Log in" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Profile" })).toBeNull();
  });

  it("renders the toast region and a skip link", () => {
    renderAt("/explore");
    expect(screen.getByRole("region", { name: "Notifications" }).getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main-content");
  });
});
