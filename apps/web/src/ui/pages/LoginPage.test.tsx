import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureTestHttp } from "../../state/auth.test-utils";
import { createQueryClient } from "../../state/queryClient";
import { clearSession, getSessionToken } from "../../state/session";
import { me } from "../../test/fixtures";
import { PublicOnly } from "../layout/PublicOnly";
import { RequireAuth } from "../layout/RequireAuth";
import { LoginPage, withNext } from "./LoginPage";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { element: <PublicOnly />, children: [{ path: "/login", element: <LoginPage /> }] },
      { path: "/signup", element: <Where /> },
      { element: <RequireAuth />, children: [{ path: "*", element: <Where /> }] },
    ],
    { initialEntries: [path], future: { v7_relativeSplatPath: true } },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
  return router;
}

const loginInput = () => screen.getByLabelText("Username or email");
const passwordInput = () => screen.getByLabelText("Password");

function fill(login: string, password: string) {
  fireEvent.change(loginInput(), { target: { value: login } });
  fireEvent.change(passwordInput(), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
}

const authOk = () =>
  json(200, {
    access_token: "tok",
    token_type: "Bearer",
    expires_at: "2099-01-01T00:00:00.000Z",
    user: me(),
  });

describe("withNext", () => {
  it("keeps only safe next paths", () => {
    expect(withNext("/signup", "/create")).toBe("/signup?next=%2Fcreate");
    expect(withNext("/signup", "//evil.com")).toBe("/signup");
    expect(withNext("/signup", "/")).toBe("/signup");
    expect(withNext("/signup", null)).toBe("/signup");
  });
});

describe("LoginPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    configureTestHttp(fetchMock);
  });

  afterEach(() => clearSession());

  it("shows inline client errors without calling the API", () => {
    renderAt("/login");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByText("Enter your username or email.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(loginInput().getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears a field error once the field is edited", () => {
    renderAt("/login");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    fireEvent.change(loginInput(), { target: { value: "a" } });
    expect(screen.queryByText("Enter your username or email.")).toBeNull();
  });

  it("maps VALIDATION_FAILED.details onto fields", async () => {
    fetchMock.mockResolvedValue(
      json(400, {
        error: {
          code: "VALIDATION_FAILED",
          message: "Invalid request",
          request_id: "r",
          details: [{ path: "login", message: "Too long" }],
        },
      }),
    );
    renderAt("/login");
    fill("alice", "pw");
    expect(await screen.findByText("Too long")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows INVALID_CREDENTIALS as a form error and clears the password", async () => {
    fetchMock.mockResolvedValue(
      json(401, {
        error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password", request_id: "r" },
      }),
    );
    renderAt("/login");
    fill("alice", "wrong");
    expect((await screen.findByRole("alert")).textContent).toBe("Invalid username or password");
    expect((passwordInput() as HTMLInputElement).value).toBe("");
    expect(getSessionToken()).toBeNull();
  });

  it("logs in and returns to the ?next path", async () => {
    fetchMock.mockResolvedValue(authOk());
    renderAt("/login?next=%2Fcreate%3Fx%3D1");
    fill("alice", "password1");
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/create?x=1"));
    expect(getSessionToken()).toBe("tok");
  });

  it("ignores an unsafe ?next and goes home", async () => {
    fetchMock.mockResolvedValue(authOk());
    renderAt("/login?next=%2F%2Fevil.com");
    fill("alice", "password1");
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/"));
  });

  it("links to sign up keeping ?next", () => {
    renderAt("/login?next=%2Fcreate");
    fireEvent.click(screen.getByRole("link", { name: "Sign up" }));
    expect(screen.getByTestId("where").textContent).toBe("/signup?next=%2Fcreate");
  });

  it("protected routes redirect to /login?next when logged out", () => {
    renderAt("/settings/profile");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeTruthy();
  });
});
