import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureHttp } from "../api/http";
import { me } from "../test/fixtures";
import {
  applyAuthResponse,
  hasErrors,
  performLogout,
  useLoginMutation,
  useLogoutMutation,
  useSignupMutation,
  usernameError,
  validateLoginForm,
  validateSignupForm,
} from "./auth";
import { toMeVM } from "./mappers/user";
import { queryKeys } from "./query-keys";
import { createQueryClient } from "./queryClient";
import { clearSession, getSession, getSessionToken, setSession } from "./session";
import { getToasts, showToast } from "./toast";

const FUTURE = "2099-01-01T00:00:00.000Z";

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: "tok_new",
    token_type: "Bearer" as const,
    expires_at: FUTURE,
    user: me(),
    ...overrides,
  };
}

const validSignup = { username: "alice", email: "alice@example.com", password: "password1", fullName: "" };

describe("usernameError / validateSignupForm", () => {
  it.each([
    ["abc", null],
    ["a".repeat(30), null],
    ["Alice.Smith_1", null],
    ["", "Enter a username."],
    ["ab", "Usernames are 3–30 characters."],
    ["a".repeat(31), "Usernames are 3–30 characters."],
    ["al ice", "Only letters, digits, '.' and '_' are allowed."],
    ["al-ice", "Only letters, digits, '.' and '_' are allowed."],
    [".alice", "Usernames can't start or end with '.'."],
    ["alice.", "Usernames can't start or end with '.'."],
  ])("usernameError(%j)", (value, expected) => {
    expect(usernameError(value)).toBe(expected);
  });

  it("accepts a valid form", () => {
    expect(validateSignupForm(validSignup)).toEqual({});
  });

  it("flags every invalid field", () => {
    const errors = validateSignupForm({
      username: "a",
      email: "nope",
      password: "short",
      fullName: "x".repeat(61),
    });
    expect(Object.keys(errors).sort()).toEqual(["email", "fullName", "password", "username"]);
    expect(hasErrors(errors)).toBe(true);
  });

  it.each([
    [7, true],
    [8, false],
    [128, false],
    [129, true],
  ])("password of %i chars invalid=%s", (length, invalid) => {
    const errors = validateSignupForm({ ...validSignup, password: "p".repeat(length) });
    expect(Boolean(errors.password)).toBe(invalid);
  });

  it("full name boundary is 60 code points", () => {
    expect(validateSignupForm({ ...validSignup, fullName: "é".repeat(60) }).fullName).toBeUndefined();
    expect(validateSignupForm({ ...validSignup, fullName: "é".repeat(61) }).fullName).toBeDefined();
  });

  it("requires an email", () => {
    expect(validateSignupForm({ ...validSignup, email: "  " }).email).toBe("Enter your email.");
  });
});

describe("validateLoginForm", () => {
  it("requires both fields", () => {
    expect(validateLoginForm({ login: " ", password: "" })).toEqual({
      login: "Enter your username or email.",
      password: "Enter your password.",
    });
    expect(validateLoginForm({ login: "alice", password: "x" })).toEqual({});
  });

  it("rejects over-long values", () => {
    const errors = validateLoginForm({ login: "a".repeat(255), password: "p".repeat(129) });
    expect(errors.login).toBeDefined();
    expect(errors.password).toBeDefined();
  });
});

describe("auth mutations", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: ReturnType<typeof createQueryClient>;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    fetchMock = vi.fn();
    client = createQueryClient();
    configureHttp({
      baseUrl: "http://api.test",
      getToken: getSessionToken,
      validateResponses: true,
      fetch: fetchMock,
    });
  });

  afterEach(() => clearSession());

  it("applyAuthResponse drops the previous user's cache and seeds me", () => {
    client.setQueryData(["feed"], { stale: true });
    applyAuthResponse(client, authResponse());
    expect(client.getQueryData(["feed"])).toBeUndefined();
    expect(client.getQueryData(queryKeys.me())).toEqual(toMeVM(me()));
    expect(getSession()).toMatchObject({ token: "tok_new", expiresAt: FUTURE });
  });

  it("login posts the trimmed handle and stores the session", async () => {
    fetchMock.mockResolvedValue(json(200, authResponse()));
    const { result } = renderHook(() => useLoginMutation(), { wrapper });
    await act(() => result.current.mutateAsync({ login: "  alice ", password: " pw " }));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/v1/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ login: "alice", password: " pw " });
    expect(getSessionToken()).toBe("tok_new");
    expect(getSession().me?.username).toBe("alice");
  });

  it("login failure leaves the session untouched", async () => {
    fetchMock.mockResolvedValue(
      json(401, { error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials", request_id: "r" } }),
    );
    const { result } = renderHook(() => useLoginMutation(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ login: "alice", password: "bad" })).rejects.toMatchObject({
        status: 401,
      });
    });
    expect(getSessionToken()).toBeNull();
  });

  it("signup sends a lowercased username and snake_case body", async () => {
    fetchMock.mockResolvedValue(json(201, authResponse()));
    const { result } = renderHook(() => useSignupMutation(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        username: " Alice ",
        email: "a@b.co ",
        password: "password1",
        fullName: " Al ",
      }),
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/v1/auth/signup");
    expect(JSON.parse(init.body as string)).toEqual({
      username: "alice",
      email: "a@b.co",
      password: "password1",
      full_name: "Al",
    });
    expect(getSessionToken()).toBe("tok_new");
  });

  describe("logout", () => {
    beforeEach(() => {
      setSession({ token: "tok_old", expiresAt: FUTURE, me: toMeVM(me()) });
      client.setQueryData(queryKeys.me(), toMeVM(me()));
      client.setQueryData(["feed"], { pages: [] });
      showToast("hello");
    });

    it("revokes the session server-side and clears session, caches and toasts", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
      await performLogout(client);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://api.test/api/v1/auth/logout");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok_old");
      expect(getSessionToken()).toBeNull();
      expect(client.getQueryCache().getAll()).toHaveLength(0);
      expect(getToasts()).toHaveLength(0);
    });

    it("still clears everything when the API call fails", async () => {
      fetchMock.mockRejectedValue(new TypeError("offline"));
      await performLogout(client);
      expect(getSessionToken()).toBeNull();
      expect(client.getQueryData(queryKeys.me())).toBeUndefined();
    });

    it("skips the API call when already signed out", async () => {
      clearSession();
      await performLogout(client);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("useLogoutMutation runs onLoggedOut after clearing", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
      const onLoggedOut = vi.fn(() => expect(getSessionToken()).toBeNull());
      const { result } = renderHook(() => useLogoutMutation({ onLoggedOut }), { wrapper });
      act(() => result.current.mutate());
      await waitFor(() => expect(onLoggedOut).toHaveBeenCalledTimes(1));
    });
  });
});
