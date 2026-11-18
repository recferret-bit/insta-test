import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureTestHttp } from "../../state/auth.test-utils";
import { toMeVM } from "../../state/mappers/user";
import { createQueryClient } from "../../state/queryClient";
import { queryKeys } from "../../state/query-keys";
import { clearSession, setSession } from "../../state/session";
import type { UploadFn } from "../../state/upload";
import { hexId, me, media, post } from "../../test/fixtures";
import { RequireAuth } from "../layout/RequireAuth";
import { CreatePostPage, publishStatus } from "./CreatePostPage";

const FUTURE = "2099-01-01T00:00:00.000Z";
const NEW_ID = hexId("pst", 77);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function Where() {
  const { pathname } = useLocation();
  return <p data-testid="where">{pathname}</p>;
}

type Pending = { name: string; resolve: (n: number) => void; reject: (e: unknown) => void };

function fakeUpload() {
  const pending: Pending[] = [];
  const upload = vi.fn(
    (input: Parameters<UploadFn>[0]) =>
      new Promise<ReturnType<typeof media>>((resolve, reject) => {
        pending.push({
          name: input.fileName ?? "",
          resolve: (n) => resolve(media({ id: hexId("med", n) })),
          reject,
        });
      }),
  ) as unknown as UploadFn;
  return { upload, pending };
}

function renderPage(upload: UploadFn) {
  const client = createQueryClient();
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [
          {
            path: "/create",
            element: (
              <CreatePostPage
                upload={upload}
                createPreviewUrl={(f) => `blob:${f.name}`}
                revokePreviewUrl={() => undefined}
              />
            ),
          },
        ],
      },
      { path: "*", element: <Where /> },
    ],
    { initialEntries: ["/create"], future: { v7_relativeSplatPath: true } },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
  return client;
}

const share = () => screen.getByRole("button", { name: "Share" }) as HTMLButtonElement;
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const img = (name: string) => new File([new Uint8Array(10)], name, { type: "image/jpeg" });

describe("CreatePostPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith("/posts") && init.method === "POST") {
        const body = JSON.parse(init.body as string) as { caption: string; media_ids: string[] };
        return Promise.resolve(
          json(
            201,
            post({ id: NEW_ID, caption: body.caption, media: body.media_ids.map((id) => media({ id })) }),
          ),
        );
      }
      return Promise.reject(new Error(`unexpected ${init.method} ${url}`));
    });
    configureTestHttp(fetchMock as unknown as typeof fetch);
    setSession({ token: "tok", expiresAt: FUTURE, me: toMeVM(me()) });
  });

  afterEach(() => clearSession());

  it("uploads picked files, keeps Share disabled until all succeed, publishes in display order", async () => {
    const { upload, pending } = fakeUpload();
    const client = renderPage(upload);
    expect(share().disabled).toBe(true);
    expect(screen.getByText("Add at least one photo or video.")).toBeTruthy();

    await act(async () => {
      fireEvent.change(fileInput(), { target: { files: [img("one.jpg"), img("two.jpg")] } });
    });
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(screen.getByLabelText("Caption")).toBeTruthy();
    expect(share().disabled).toBe(true);
    expect(screen.getByText("Uploading… 0 of 2 done.")).toBeTruthy();

    await act(async () => pending[0]?.resolve(1));
    expect(share().disabled).toBe(true);
    await act(async () => pending[1]?.resolve(2));
    await waitFor(() => expect(share().disabled).toBe(false));

    // Reorder: two.jpg first.
    fireEvent.click(screen.getByRole("button", { name: "Move Photo 1 (one.jpg) later" }));
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Hello #world" } });
    expect(screen.getByText("12/2200")).toBeTruthy();
    expect(screen.getByText("1/30 hashtags")).toBeTruthy();

    fireEvent.click(share());
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe(`/p/${NEW_ID}`));
    const call = fetchMock.mock.calls.find(([u]) => (u as string).endsWith("/posts"));
    expect(JSON.parse((call?.[1] as RequestInit).body as string)).toEqual({
      caption: "Hello #world",
      media_ids: [hexId("med", 2), hexId("med", 1)],
    });
    expect(client.getQueryData(queryKeys.post(NEW_ID))).toMatchObject({
      id: NEW_ID,
      caption: "Hello #world",
    });
  });

  it("rejects unsupported files client-side without uploading", async () => {
    const { upload } = fakeUpload();
    renderPage(upload);
    await act(async () => {
      fireEvent.change(fileInput(), {
        target: { files: [new File(["x"], "anim.gif", { type: "image/gif" })] },
      });
    });
    expect(screen.getByRole("alert").textContent).toMatch(/anim\.gif: Choose a JPEG/);
    expect(upload).not.toHaveBeenCalled();
    expect(share().disabled).toBe(true);
  });

  it("blocks publishing while an upload failed, and offers retry", async () => {
    const { upload, pending } = fakeUpload();
    renderPage(upload);
    await act(async () => {
      fireEvent.change(fileInput(), { target: { files: [img("one.jpg")] } });
    });
    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => pending[0]?.reject(new TypeError("offline")));
    expect(screen.getByText("1 upload failed. Retry or remove it.")).toBeTruthy();
    expect(share().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => pending[1]?.resolve(3));
    await waitFor(() => expect(share().disabled).toBe(false));
  });

  it("shows MEDIA_INVALID from the API and stays on the page", async () => {
    fetchMock.mockResolvedValue(
      json(422, { error: { code: "MEDIA_INVALID", message: "Media invalid", request_id: "r" } }),
    );
    const { upload, pending } = fakeUpload();
    renderPage(upload);
    await act(async () => {
      fireEvent.change(fileInput(), { target: { files: [img("one.jpg")] } });
    });
    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => pending[0]?.resolve(1));
    await waitFor(() => expect(share().disabled).toBe(false));
    fireEvent.click(share());
    expect(await screen.findByText(/can't be used anymore/)).toBeTruthy();
    expect(screen.queryByTestId("where")).toBeNull();
  });

  it("publishStatus summarises the composer", () => {
    const base = { total: 3, uploaded: 1, uploading: 2, queued: 0, failed: 0, ready: false, mediaIds: [] };
    expect(publishStatus(base)).toBe("Uploading… 1 of 3 done.");
    expect(publishStatus({ ...base, failed: 2 })).toBe("2 uploads failed. Retry or remove them.");
    expect(publishStatus({ ...base, uploaded: 3, ready: true })).toBe("All files uploaded. Ready to share.");
  });
});
