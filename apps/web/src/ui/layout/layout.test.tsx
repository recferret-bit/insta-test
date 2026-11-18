import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { createQueryClient } from "../../state/queryClient";
import { setThemePreference } from "../../state/theme";
import { isNavItemActive, SIDEBAR_ITEMS, TABBAR_ITEMS } from "./nav-items";
import { loginPathFor, safeNextPath } from "./next-path";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { ThemeToggle } from "./ThemeToggle";

describe("next-path", () => {
  it.each([
    [null, "/"],
    ["", "/"],
    ["/create", "/create"],
    ["/u/a?x=1", "/u/a?x=1"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
  ])("safeNextPath(%j) = %s", (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });

  it("loginPathFor", () => {
    expect(loginPathFor("/")).toBe("/login");
    expect(loginPathFor("/create?x=1")).toBe("/login?next=%2Fcreate%3Fx%3D1");
  });
});

describe("nav items", () => {
  const byKey = (items: typeof SIDEBAR_ITEMS, key: string) => items.find((i) => i.key === key)!;

  it("home is only active on /", () => {
    expect(isNavItemActive(byKey(SIDEBAR_ITEMS, "home"), "/")).toBe(true);
    expect(isNavItemActive(byKey(SIDEBAR_ITEMS, "home"), "/explore")).toBe(false);
  });

  it("create covers /create/story; mobile explore covers search and tags", () => {
    expect(isNavItemActive(byKey(SIDEBAR_ITEMS, "create"), "/create/story")).toBe(true);
    expect(isNavItemActive(byKey(TABBAR_ITEMS, "explore"), "/search")).toBe(true);
    expect(isNavItemActive(byKey(TABBAR_ITEMS, "explore"), "/tags/x")).toBe(true);
    expect(isNavItemActive(byKey(SIDEBAR_ITEMS, "search"), "/searching")).toBe(false);
  });
});

describe("ThemeToggle", () => {
  afterEach(() => setThemePreference("system"));

  it("cycles the theme and updates its accessible name", () => {
    setThemePreference("light");
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /Theme: Light/ });
    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: /Theme: Dark/ })).toBeTruthy();
  });
});

describe("RouteErrorBoundary", () => {
  function Boom(): JSX.Element {
    throw new Error("kaboom");
  }

  it("shows an alert with Retry for render errors", () => {
    const router = createMemoryRouter(
      [{ path: "/", element: <Boom />, errorElement: <RouteErrorBoundary /> }],
      {
        future: { v7_relativeSplatPath: true },
      },
    );
    const original = console.error;
    console.error = () => undefined;
    try {
      render(
        <QueryClientProvider client={createQueryClient()}>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </QueryClientProvider>,
      );
    } finally {
      console.error = original;
    }
    expect(screen.getByRole("alert").textContent).toContain("Something went wrong");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
