import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureTestHttp } from "../../state/auth.test-utils";
import { createQueryClient } from "../../state/queryClient";
import { clearSession, getSession } from "../../state/session";
import { me } from "../../test/fixtures";
import { PublicOnly } from "../layout/PublicOnly";
import { SignupPage } from "./SignupPage";

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
      { element: <PublicOnly />, children: [{ path: "/signup", element: <SignupPage /> }] },
      { path: "*", element: <Where /> },
    ],
    { initialEntries: [path], future: { v7_relativeSplatPath: true } },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
}

function fillValid() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Alice" } });
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Alice" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

describe("SignupPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    configureTestHttp(fetchMock);
  });

  afterEach(() => clearSession());

  it("validates client-side before calling the API", () => {
    renderAt("/signup");
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "bad name" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
    submit();
    expect(screen.getByText("Enter your email.")).toBeTruthy();
    expect(screen.getByText("Only letters, digits, '.' and '_' are allowed.")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps VALIDATION_FAILED.details (snake_case paths) onto fields", async () => {
    fetchMock.mockResolvedValue(
      json(400, {
        error: {
          code: "VALIDATION_FAILED",
          message: "Invalid request",
          request_id: "r",
          details: [
            { path: "email", message: "Invalid email" },
            { path: "full_name", message: "Too long" },
            { path: "unknown", message: "Something else" },
          ],
        },
      }),
    );
    renderAt("/signup");
    fillValid();
    submit();
    expect(await screen.findByText("Invalid email")).toBeTruthy();
    expect(screen.getByText("Too long")).toBeTruthy();
    expect(screen.getByLabelText("Full name").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Something else");
  });

  it("maps 409 USERNAME_TAKEN to the username field", async () => {
    fetchMock.mockResolvedValue(
      json(409, { error: { code: "USERNAME_TAKEN", message: "That username is taken", request_id: "r" } }),
    );
    renderAt("/signup");
    fillValid();
    submit();
    expect(await screen.findByText("That username is taken")).toBeTruthy();
    expect(screen.getByLabelText("Username").getAttribute("aria-invalid")).toBe("true");
  });

  it("maps 409 EMAIL_TAKEN to the email field", async () => {
    fetchMock.mockResolvedValue(
      json(409, { error: { code: "EMAIL_TAKEN", message: "Email already registered", request_id: "r" } }),
    );
    renderAt("/signup");
    fillValid();
    submit();
    expect(await screen.findByText("Email already registered")).toBeTruthy();
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("true");
  });

  it("signs up, persists the session and follows ?next", async () => {
    fetchMock.mockResolvedValue(
      json(201, {
        access_token: "tok",
        token_type: "Bearer",
        expires_at: "2099-01-01T00:00:00.000Z",
        user: me(),
      }),
    );
    renderAt("/signup?next=%2Fsettings%2Fprofile");
    fillValid();
    submit();
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/settings/profile"));
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({
      username: "alice",
      email: "alice@example.com",
      password: "password1",
      full_name: "Alice",
    });
    expect(getSession().token).toBe("tok");
    expect(window.localStorage.getItem("insta.session")).toContain("tok");
  });

  it("links to log in keeping ?next", () => {
    renderAt("/signup?next=%2Fcreate");
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login?next=%2Fcreate");
  });
});
