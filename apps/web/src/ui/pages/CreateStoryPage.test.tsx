import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { configureTestHttp } from "../../state/auth.test-utils";
import { toMeVM } from "../../state/mappers/user";
import { createQueryClient } from "../../state/queryClient";
import { clearSession, setSession } from "../../state/session";
import { clearToasts, getToasts } from "../../state/toast";
import type { UploadFn } from "../../state/upload";
import { hexId, me, media, story } from "../../test/fixtures";
import { CreateStoryPage } from "./CreateStoryPage";

const FUTURE = "2099-01-01T00:00:00.000Z";
const storyMedia = media({ id: hexId("med", 7), purpose: "story" });

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

function renderPage(opts: { upload: UploadFn; probe?: (file: File) => Promise<number | null> }) {
  const router = createMemoryRouter(
    [
      {
        path: "/create/story",
        element: <CreateStoryPage upload={opts.upload} probeDuration={opts.probe ?? (async () => 10_000)} />,
      },
      { path: "*", element: <Where /> },
    ],
    { initialEntries: ["/create/story"], future: { v7_relativeSplatPath: true } },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
}

const pick = (file: File) =>
  fireEvent.change(screen.getByTestId("story-file-input"), { target: { files: [file] } });
const share = () => screen.getByRole("button", { name: "Share to story" }) as HTMLButtonElement;
const image = () => new File([new Uint8Array(100)], "a.jpg", { type: "image/jpeg" });

describe("CreateStoryPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearToasts();
    clearSession();
    setSession({ token: "tok", expiresAt: FUTURE, me: toMeVM(me()) });
    fetchMock = vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith("/stories") && init.method === "POST")
        return Promise.resolve(json(201, story({ media: storyMedia })));
      return Promise.reject(new Error(`unexpected ${init.method} ${url}`));
    });
    configureTestHttp(fetchMock as unknown as typeof fetch);
  });

  it("uploads with purpose story, then POSTs /stories with the media id and returns home", async () => {
    const upload = vi.fn<UploadFn>(async () => storyMedia);
    renderPage({ upload });
    expect(share().disabled).toBe(true);
    pick(image());
    await waitFor(() => expect(share().disabled).toBe(false));
    expect(upload.mock.calls[0]![0]).toMatchObject({ purpose: "story", fileName: "a.jpg" });
    expect(screen.getByRole("img", { name: "Story preview" })).toBeTruthy();

    fireEvent.click(share());
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/"));
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ media_id: storyMedia.id });
    expect(getToasts().map((t) => t.message)).toContain("Added to your story");
  });

  it("rejects an unsupported file without uploading", async () => {
    const upload = vi.fn<UploadFn>();
    renderPage({ upload });
    pick(new File([new Uint8Array(10)], "a.gif", { type: "image/gif" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/JPEG, PNG or WebP/);
    expect(upload).not.toHaveBeenCalled();
    expect(share().disabled).toBe(true);
  });

  it("rejects a video longer than 60 s", async () => {
    const upload = vi.fn<UploadFn>();
    renderPage({ upload, probe: async () => 61_000 });
    pick(new File([new Uint8Array(10)], "v.mp4", { type: "video/mp4" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/60 seconds or shorter/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("shows upload failures with retry", async () => {
    const upload = vi
      .fn<UploadFn>()
      .mockRejectedValueOnce(Object.assign(new Error("too big"), { status: 413 }))
      .mockResolvedValueOnce(storyMedia);
    renderPage({ upload });
    pick(image());
    expect((await screen.findByRole("alert")).textContent).toContain("That file is too large.");
    expect(share().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(share().disabled).toBe(false));
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("shows a server rejection (422 MEDIA_INVALID) and stays on the page", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json(422, {
          error: { code: "MEDIA_INVALID", message: "Media is not usable for a story.", request_id: "r" },
        }),
      ),
    );
    renderPage({ upload: async () => storyMedia });
    pick(image());
    await waitFor(() => expect(share().disabled).toBe(false));
    fireEvent.click(share());
    expect((await screen.findByRole("alert")).textContent).toContain("Media is not usable for a story.");
    expect(screen.queryByTestId("where")).toBeNull();
  });
});
