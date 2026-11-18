import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApiError } from "../api/http";
import { errorMessage, isNotFound, isRateLimited } from "./errors";
import { unreadBadgeLabel, useUnreadCount } from "./notifications";
import { queryKeys, STALE_TIMES } from "./query-keys";
import { createQueryClient, shouldRetry } from "./queryClient";
import { useLiveConnection } from "./sse";
import {
  applyThemePreference,
  nextThemePreference,
  setThemePreference,
  THEME_STORAGE_KEY,
  useThemePreference,
} from "./theme";
import { clearToasts, dismissToast, getToasts, showToast } from "./toast";

const apiError = (status: number, code: string) =>
  new ApiError(status, { error: { code: code as never, message: "m", request_id: "r" } });

describe("query keys & stale times (frontend/02 table)", () => {
  it("builds keys", () => {
    expect(queryKeys.feed()).toEqual(["feed"]);
    expect(queryKeys.post("p")).toEqual(["post", "p"]);
    expect(queryKeys.followList("followers", "bob")).toEqual(["followers", "bob"]);
    expect(queryKeys.search("hashtags", "sun")).toEqual(["search", "hashtags", "sun"]);
  });

  it("matches the spec stale times", () => {
    expect(STALE_TIMES.me).toBe(300_000);
    expect(STALE_TIMES.feed).toBe(30_000);
    expect(STALE_TIMES.profile).toBe(60_000);
    expect(STALE_TIMES.notifications).toBe(0);
    expect(STALE_TIMES.unreadCount).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("queryClient", () => {
  it("retries network errors and 5xx at most twice, never 4xx", () => {
    expect(shouldRetry(0, new TypeError("net"))).toBe(true);
    expect(shouldRetry(1, apiError(503, "INTERNAL"))).toBe(true);
    expect(shouldRetry(2, apiError(503, "INTERNAL"))).toBe(false);
    expect(shouldRetry(0, apiError(404, "NOT_FOUND"))).toBe(false);
    expect(shouldRetry(0, apiError(429, "RATE_LIMITED"))).toBe(false);
  });

  it("shows a 'Slow down' toast for 429 query errors", async () => {
    clearToasts();
    const client = createQueryClient();
    await client
      .fetchQuery({
        queryKey: ["x"],
        queryFn: () => Promise.reject(apiError(429, "RATE_LIMITED")),
        retry: false,
      })
      .catch(() => undefined);
    expect(getToasts().map((t) => t.message)).toEqual(["Slow down"]);
    clearToasts();
  });
});

describe("error helpers", () => {
  it("classifies errors", () => {
    expect(isRateLimited(apiError(429, "RATE_LIMITED"))).toBe(true);
    expect(isNotFound(apiError(404, "NOT_FOUND"))).toBe(true);
    expect(errorMessage(apiError(500, "INTERNAL"))).toBe("m");
    expect(errorMessage(new TypeError("x"))).toMatch(/network/i);
    expect(errorMessage("weird")).toMatch(/something went wrong/i);
  });
});

describe("toast store", () => {
  afterEach(() => clearToasts());

  it("queues, caps at 4 and dismisses", () => {
    const ids = [1, 2, 3, 4, 5].map((n) => showToast(`t${n}`));
    expect(getToasts().map((t) => t.message)).toEqual(["t2", "t3", "t4", "t5"]);
    dismissToast(ids[2]!);
    expect(getToasts().map((t) => t.message)).toEqual(["t2", "t4", "t5"]);
    expect(getToasts()[0]!.tone).toBe("info");
  });
});

describe("theme", () => {
  afterEach(() => setThemePreference("system"));

  it("cycles light → dark → system", () => {
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("system");
    expect(nextThemePreference("system")).toBe("light");
  });

  it("applies data-theme and persists the preference", () => {
    const { result } = renderHook(() => useThemePreference());
    act(() => setThemePreference("dark"));
    expect(result.current).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    act(() => setThemePreference("system"));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("applyThemePreference on an arbitrary root", () => {
    const el = document.createElement("div");
    applyThemePreference("light", el);
    expect(el.dataset.theme).toBe("light");
  });
});

describe("w00 stubs", () => {
  it("unread count is 0 and badge labels are capped", () => {
    expect(renderHook(() => useUnreadCount()).result.current).toBe(0);
    expect(unreadBadgeLabel(0)).toBe("");
    expect(unreadBadgeLabel(3)).toBe("3");
    expect(unreadBadgeLabel(12)).toBe("9+");
  });

  it("live connection is idle", () => {
    expect(renderHook(() => useLiveConnection(true)).result.current).toBe("idle");
  });
});
