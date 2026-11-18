import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureHttp } from "../api/http";
import { hexId, me } from "../test/fixtures";
import { toMeVM } from "./mappers/user";
import {
  bioError,
  countLineBreaks,
  editProfileFormFrom,
  useMeQuery,
  useUpdateProfileMutation,
  validateEditProfileForm,
} from "./me";
import { queryKeys } from "./query-keys";
import { createQueryClient } from "./queryClient";
import { clearSession, getSession, getSessionToken, setSession } from "./session";

const FUTURE = "2099-01-01T00:00:00.000Z";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("edit profile validation", () => {
  it("counts line breaks", () => {
    expect(countLineBreaks("")).toBe(0);
    expect(countLineBreaks("a\nb\nc")).toBe(2);
  });

  it.each([
    ["x".repeat(150), null],
    ["x".repeat(151), "Bio is at most 150 characters."],
    ["😀".repeat(150), null],
    ["a\nb\nc\nd\ne", null],
    ["a\nb\nc\nd\ne\nf", "At most 4 line breaks are allowed."],
  ])("bioError(%j)", (bio, expected) => {
    expect(bioError(bio)).toBe(expected);
  });

  it("validates every field", () => {
    const vm = toMeVM(me());
    expect(validateEditProfileForm(editProfileFormFrom(vm))).toEqual({});
    const errors = validateEditProfileForm({ username: "a!", fullName: "x".repeat(61), bio: "\n".repeat(5) });
    expect(Object.keys(errors).sort()).toEqual(["bio", "fullName", "username"]);
  });

  it("editProfileFormFrom starts with an unchanged avatar", () => {
    expect(editProfileFormFrom(toMeVM(me()))).toEqual({
      username: "alice",
      fullName: "Alice Liddell",
      bio: "Down the rabbit hole",
      avatarMediaId: undefined,
    });
  });
});

describe("me query & update mutation", () => {
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

  it("does not fetch while signed out", () => {
    const { result } = renderHook(() => useMeQuery(), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches GET /me and mirrors it into the session store", async () => {
    setSession({ token: "tok", expiresAt: FUTURE, me: toMeVM(me({ bio: "old" })) });
    fetchMock.mockResolvedValue(json(200, me({ bio: "fresh" })));
    const { result } = renderHook(() => useMeQuery(), { wrapper });
    // Placeholder from the session store renders immediately.
    expect(result.current.data?.bio).toBe("old");
    await waitFor(() => expect(result.current.isSuccess && !result.current.isPlaceholderData).toBe(true));
    expect(result.current.data?.bio).toBe("fresh");
    expect(getSession().me?.bio).toBe("fresh");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.test/api/v1/me");
  });

  it("sends only changed fields and updates every cache", async () => {
    const original = toMeVM(me());
    setSession({ token: "tok", expiresAt: FUTURE, me: original });
    client.setQueryData(queryKeys.me(), original);
    const avatarId = hexId("med", 9);
    fetchMock.mockResolvedValue(json(200, me({ username: "alice2", bio: "new bio" })));
    const { result } = renderHook(() => useUpdateProfileMutation(), { wrapper });
    let next: Awaited<ReturnType<typeof result.current.mutateAsync>> = null;
    await act(async () => {
      next = await result.current.mutateAsync({
        form: { username: " Alice2 ", fullName: original.fullName, bio: "new bio", avatarMediaId: avatarId },
        original,
      });
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/v1/me");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      username: "alice2",
      bio: "new bio",
      avatar_media_id: avatarId,
    });
    expect(next).toMatchObject({ username: "alice2" });
    expect(client.getQueryData(queryKeys.me())).toMatchObject({ username: "alice2", bio: "new bio" });
    expect(getSession().me?.username).toBe("alice2");
  });

  it("resolves null without a request when nothing changed", async () => {
    const original = toMeVM(me());
    const { result } = renderHook(() => useUpdateProfileMutation(), { wrapper });
    let next: unknown = "unset";
    await act(async () => {
      next = await result.current.mutateAsync({ form: editProfileFormFrom(original), original });
    });
    expect(next).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("removing an existing avatar sends avatar_media_id: null", async () => {
    const original = toMeVM(me());
    setSession({ token: "tok", expiresAt: FUTURE, me: original });
    fetchMock.mockResolvedValue(json(200, me({ avatar_url: null })));
    const { result } = renderHook(() => useUpdateProfileMutation(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        form: { ...editProfileFormFrom(original), avatarMediaId: null },
        original,
      }),
    );
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({
      avatar_media_id: null,
    });
    expect(getSession().me?.hasCustomAvatar).toBe(false);
  });
});
