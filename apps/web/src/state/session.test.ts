import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureHttp } from "../api/http";
import { me } from "../test/fixtures";
import { toMeVM } from "./mappers/user";
import {
  bootstrapSession,
  clearSession,
  getSession,
  getSessionToken,
  parseStoredSession,
  SESSION_STORAGE_KEY,
  setSession,
  setSessionMe,
  useIsAuthenticated,
  useSession,
} from "./session";

const FUTURE = "2099-01-01T00:00:00.000Z";
const meVM = toMeVM(me());

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("session store", () => {
  afterEach(() => clearSession());

  it("parseStoredSession accepts valid data and rejects malformed or expired values", () => {
    const valid = JSON.stringify({ token: "t", expiresAt: FUTURE, me: meVM });
    expect(parseStoredSession(valid)).toEqual({ token: "t", expiresAt: FUTURE, me: meVM });
    expect(parseStoredSession(null).token).toBeNull();
    expect(parseStoredSession("{not json").token).toBeNull();
    expect(parseStoredSession(JSON.stringify({ token: 5 })).token).toBeNull();
    expect(
      parseStoredSession(JSON.stringify({ token: "t", expiresAt: "2000-01-01T00:00:00.000Z" })).token,
    ).toBeNull();
    expect(parseStoredSession(JSON.stringify({ token: "t", expiresAt: FUTURE, me: "bad" })).me).toBeNull();
  });

  it("setSession persists to localStorage and notifies subscribers", () => {
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(false);
    act(() => setSession({ token: "tok", expiresAt: FUTURE, me: meVM }));
    expect(result.current).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY)!)).toMatchObject({ token: "tok" });
    expect(getSessionToken()).toBe("tok");
  });

  it("clearSession removes the persisted value", () => {
    setSession({ token: "tok", expiresAt: FUTURE, me: meVM });
    clearSession();
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(getSession()).toEqual({ token: null, expiresAt: null, me: null });
  });

  it("an expired token is cleared on read", () => {
    setSession({ token: "tok", expiresAt: "2000-01-01T00:00:00.000Z", me: meVM });
    expect(getSessionToken()).toBeNull();
    expect(getSession().token).toBeNull();
  });

  it("setSessionMe is a no-op when signed out", () => {
    setSessionMe(meVM);
    expect(getSession().me).toBeNull();
  });

  it("syncs logout/login from another tab via the storage event", () => {
    setSession({ token: "tok", expiresAt: FUTURE, me: meVM });
    const { result } = renderHook(() => useSession());
    act(() => {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: SESSION_STORAGE_KEY }));
    });
    expect(result.current.token).toBeNull();
    act(() => {
      window.localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ token: "other", expiresAt: FUTURE, me: null }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: SESSION_STORAGE_KEY }));
    });
    expect(result.current.token).toBe("other");
  });

  describe("bootstrapSession", () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    beforeEach(() => {
      fetchMock.mockReset();
      configureHttp({
        baseUrl: "http://api.test",
        getToken: getSessionToken,
        validateResponses: true,
        fetch: fetchMock,
      });
    });

    it("does nothing without a token", async () => {
      await bootstrapSession();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refreshes me with GET /me", async () => {
      setSession({ token: "tok", expiresAt: FUTURE, me: meVM });
      fetchMock.mockResolvedValue(json(200, me({ bio: "updated" })));
      await bootstrapSession();
      expect(fetchMock.mock.calls[0]![0]).toBe("http://api.test/api/v1/me");
      expect(getSession().me?.bio).toBe("updated");
    });

    it("clears the session on 401", async () => {
      setSession({ token: "tok", expiresAt: FUTURE, me: meVM });
      fetchMock.mockResolvedValue(
        json(401, { error: { code: "UNAUTHENTICATED", message: "no", request_id: "r" } }),
      );
      await bootstrapSession();
      expect(getSession().token).toBeNull();
    });

    it("keeps the cached session on network/5xx errors", async () => {
      setSession({ token: "tok", expiresAt: FUTURE, me: meVM });
      fetchMock.mockResolvedValue(json(500, { error: { code: "INTERNAL", message: "x", request_id: "r" } }));
      await bootstrapSession();
      expect(getSession().token).toBe("tok");
    });
  });
});
