import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toMeVM } from "../../state/mappers/user";
import { queryKeys } from "../../state/query-keys";
import { configureTestHttp } from "../../state/auth.test-utils";
import { createQueryClient } from "../../state/queryClient";
import { clearSession, getSession, getSessionToken, setSession } from "../../state/session";
import type { UploadFn } from "../../state/upload";
import { hexId, me, media } from "../../test/fixtures";
import { RequireAuth } from "../layout/RequireAuth";
import { EditProfilePage } from "./EditProfilePage";

const FUTURE = "2099-01-01T00:00:00.000Z";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

function renderPage(upload?: UploadFn) {
  const client = createQueryClient();
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [{ path: "/settings/profile", element: <EditProfilePage upload={upload} /> }],
      },
      { path: "*", element: <Where /> },
    ],
    { initialEntries: ["/settings/profile"], future: { v7_relativeSplatPath: true } },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
  return client;
}

function patchBody(fetchMock: ReturnType<typeof vi.fn>): unknown {
  const call = fetchMock.mock.calls.find(([, init]) => (init as RequestInit).method === "PATCH");
  return call ? JSON.parse((call[1] as RequestInit).body as string) : undefined;
}

const saveButton = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

describe("EditProfilePage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith("/me") && init.method === "GET") return Promise.resolve(json(200, me()));
      return Promise.reject(new Error(`unexpected ${init.method} ${url}`));
    });
    configureTestHttp(fetchMock);
    setSession({ token: "tok", expiresAt: FUTURE, me: toMeVM(me()) });
  });

  afterEach(() => clearSession());

  it("prefills from me with counters and keeps Save disabled until something changes", async () => {
    renderPage();
    const username = (await screen.findByLabelText("Username")) as HTMLInputElement;
    expect(username.value).toBe("alice");
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Alice Liddell");
    expect((screen.getByLabelText("Bio") as HTMLTextAreaElement).value).toBe("Down the rabbit hole");
    expect(screen.getByText("5/30")).toBeTruthy();
    expect(screen.getByText("13/60")).toBeTruthy();
    expect(screen.getByText("20/150")).toBeTruthy();
    expect(screen.getByText("0/4 line breaks")).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "a\nb" } });
    expect(screen.getByText("3/150")).toBeTruthy();
    expect(screen.getByText("1/4 line breaks")).toBeTruthy();
    expect(saveButton().disabled).toBe(false);
  });

  it("rejects more than 4 line breaks client-side", async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText("Bio"), { target: { value: "1\n2\n3\n4\n5\n6" } });
    fireEvent.click(saveButton());
    expect(screen.getByText("At most 4 line breaks are allowed.")).toBeTruthy();
    expect(patchBody(fetchMock)).toBeUndefined();
  });

  it("PATCHes only changed fields and updates the session", async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit) =>
      Promise.resolve(json(200, init.method === "PATCH" ? me({ full_name: "Alice L." }) : me())),
    );
    const client = renderPage();
    fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: " Alice L. " } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(getSession().me?.fullName).toBe("Alice L."));
    expect(patchBody(fetchMock)).toEqual({ full_name: "Alice L." });
    expect(client.getQueryData(queryKeys.me())).toMatchObject({ fullName: "Alice L." });
    await waitFor(() =>
      expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Alice L."),
    );
    expect(saveButton().disabled).toBe(true);
  });

  it("maps 409 USERNAME_TAKEN and VALIDATION_FAILED details to fields", async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve(
        init.method === "PATCH"
          ? json(400, {
              error: {
                code: "VALIDATION_FAILED",
                message: "Invalid",
                request_id: "r",
                details: [
                  { path: "username", message: "Username rejected" },
                  { path: "bio", message: "Bio rejected" },
                ],
              },
            })
          : json(200, me()),
      ),
    );
    renderPage();
    fireEvent.change(await screen.findByLabelText("Username"), { target: { value: "bob" } });
    fireEvent.click(saveButton());
    expect(await screen.findByText("Username rejected")).toBeTruthy();
    expect(screen.getByText("Bio rejected")).toBeTruthy();

    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve(
        init.method === "PATCH"
          ? json(409, { error: { code: "USERNAME_TAKEN", message: "Taken", request_id: "r" } })
          : json(200, me()),
      ),
    );
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "bobby" } });
    fireEvent.click(saveButton());
    expect(await screen.findByText("Taken")).toBeTruthy();
  });

  it("uploads an avatar (purpose avatar) and saves its media id", async () => {
    const avatarId = hexId("med", 7);
    let finish!: () => void;
    const upload = vi.fn<UploadFn>(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve(media({ id: avatarId, purpose: "avatar", url: "http://api.test/media/2026/11/new.png" }));
        }),
    );
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve(
        json(
          200,
          init.method === "PATCH" ? me({ avatar_url: "http://api.test/media/2026/11/new.png" }) : me(),
        ),
      ),
    );
    renderPage(upload);
    await screen.findByLabelText("Username");
    fireEvent.change(screen.getByTestId("avatar-file-input"), {
      target: { files: [new File(["x"], "me.png", { type: "image/png" })] },
    });
    expect(upload.mock.calls[0]?.[0]).toMatchObject({ purpose: "avatar" });
    expect(saveButton().disabled).toBe(true);
    await act(async () => finish());
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    expect(screen.getByRole("img", { name: "Profile photo of @alice" }).getAttribute("src")).toBe(
      "http://api.test/media/2026/11/new.png",
    );
    fireEvent.click(saveButton());
    await waitFor(() => expect(patchBody(fetchMock)).toEqual({ avatar_media_id: avatarId }));
  });

  it("removing the avatar sends avatar_media_id: null", async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      Promise.resolve(json(200, init.method === "PATCH" ? me({ avatar_url: null }) : me())),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Remove photo" }));
    fireEvent.click(saveButton());
    await waitFor(() => expect(patchBody(fetchMock)).toEqual({ avatar_media_id: null }));
  });

  it("shows an error with retry when GET /me fails", async () => {
    // 4xx is not retried (queryClient.shouldRetry), so the error state shows immediately.
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json(404, { error: { code: "NOT_FOUND", message: "Profile unavailable", request_id: "r" } }),
      ),
    );
    renderPage();
    expect(await screen.findByText("Profile unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("log out revokes the session, clears caches and lands on /login", async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit) =>
      Promise.resolve(url.endsWith("/auth/logout") ? new Response(null, { status: 204 }) : json(200, me())),
    );
    const client = renderPage();
    await screen.findByLabelText("Username");
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/login"));
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => String(url).endsWith("/auth/logout") && (init as RequestInit).method === "POST",
      ),
    ).toBe(true);
    expect(getSessionToken()).toBeNull();
    expect(window.localStorage.getItem("insta.session")).toBeNull();
    expect(client.getQueryData(queryKeys.me())).toBeUndefined();
  });
});
