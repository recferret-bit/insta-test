import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/http";
import type { UploadMediaInput, UploadOptions } from "../api/media";
import { hexId, media } from "../test/fixtures";
import {
  checkVideoMetadata,
  composerReducer,
  INITIAL_COMPOSER_STATE,
  MAX_PARALLEL_UPLOADS,
  nextUploads,
  summarizeComposer,
  tooManyFilesMessage,
  usePostComposer,
  type ComposerItem,
} from "./posts-composer";
import { INITIAL_UPLOAD_STATE, type UploadState } from "./upload";

function file(name: string, type = "image/jpeg", size = 1000): File {
  return new File([new Uint8Array(size)], name, { type });
}

function item(key: string, upload: Partial<UploadState> = {}): ComposerItem {
  return {
    key,
    file: file(`${key}.jpg`),
    name: `${key}.jpg`,
    kind: "image",
    previewUrl: "",
    video: null,
    upload: { ...INITIAL_UPLOAD_STATE, ...upload },
  };
}

describe("composerReducer", () => {
  it("adds up to 10 items and reports the overflow", () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`k${i}`));
    const state = composerReducer(INITIAL_COMPOSER_STATE, { type: "add", items, problems: [] });
    expect(state.items).toHaveLength(10);
    expect(state.problems).toEqual([tooManyFilesMessage()]);
  });

  it("moves items with clamped targets and removes them", () => {
    let state = composerReducer(INITIAL_COMPOSER_STATE, {
      type: "add",
      items: [item("a"), item("b"), item("c")],
      problems: [],
    });
    state = composerReducer(state, { type: "move", key: "c", to: 0 });
    expect(state.items.map((i) => i.key)).toEqual(["c", "a", "b"]);
    state = composerReducer(state, { type: "move", key: "c", to: 99 });
    expect(state.items.map((i) => i.key)).toEqual(["a", "b", "c"]);
    expect(composerReducer(state, { type: "move", key: "zzz", to: 0 })).toBe(state);
    state = composerReducer(state, { type: "remove", key: "b" });
    expect(state.items.map((i) => i.key)).toEqual(["a", "c"]);
  });

  it("routes upload actions through the w01 upload reducer", () => {
    let state = composerReducer(INITIAL_COMPOSER_STATE, { type: "add", items: [item("a")], problems: [] });
    state = composerReducer(state, { type: "upload", key: "a", action: { type: "start", total: 10 } });
    expect(state.items[0]?.upload.status).toBe("uploading");
    state = composerReducer(state, {
      type: "upload",
      key: "a",
      action: { type: "error", error: "x", cause: null },
    });
    expect(state.items[0]?.upload.status).toBe("error");
    expect(composerReducer(state, { type: "upload", key: "nope", action: { type: "reset" } })).toBe(state);
  });
});

describe("scheduling & summary", () => {
  it("never exceeds 3 in-flight uploads and keeps display order", () => {
    const items = [
      item("a", { status: "uploading" }),
      item("b"),
      item("c"),
      item("d"),
      item("e", { status: "success" }),
    ];
    expect(MAX_PARALLEL_UPLOADS).toBe(3);
    expect(nextUploads(items)).toEqual(["b", "c"]);
    expect(
      nextUploads(items.map((i) => ({ ...i, upload: { ...i.upload, status: "uploading" as const } }))),
    ).toEqual([]);
  });

  it("is ready only when every item uploaded; media ids follow display order", () => {
    const m = (n: number) => ({ id: hexId("med", n) }) as never;
    expect(summarizeComposer([]).ready).toBe(false);
    const done = [
      item("a", { status: "success", media: m(2) }),
      item("b", { status: "success", media: m(1) }),
    ];
    expect(summarizeComposer(done)).toMatchObject({
      ready: true,
      uploaded: 2,
      mediaIds: [hexId("med", 2), hexId("med", 1)],
    });
    expect(summarizeComposer([...done, item("c", { status: "error" })])).toMatchObject({
      ready: false,
      failed: 1,
    });
  });

  it("checks video duration (boundary 60 000 ms)", () => {
    expect(checkVideoMetadata({ durationMs: 60_000, width: 1, height: 1 })).toBeNull();
    expect(checkVideoMetadata({ durationMs: 60_001, width: 1, height: 1 })).toBe(
      "Videos must be 60 seconds or shorter.",
    );
    expect(checkVideoMetadata({ durationMs: Number.NaN, width: 1, height: 1 })).toMatch(/couldn't read/);
  });
});

type Pending = {
  input: UploadMediaInput;
  opts: UploadOptions;
  resolve: (n: number) => void;
  reject: (e: unknown) => void;
};

function fakeUpload() {
  const pending: Pending[] = [];
  const upload = vi.fn(
    (input: UploadMediaInput, opts: UploadOptions = {}) =>
      new Promise<ReturnType<typeof media>>((resolve, reject) => {
        const entry: Pending = {
          input,
          opts,
          resolve: (n) => resolve(media({ id: hexId("med", n) })),
          reject,
        };
        pending.push(entry);
        opts.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  );
  return { upload, pending };
}

describe("usePostComposer", () => {
  it("uploads at most 3 files at once, starting the next when one finishes", async () => {
    const { upload, pending } = fakeUpload();
    const { result } = renderHook(() => usePostComposer({ upload }));
    await act(() => result.current.addFiles([1, 2, 3, 4, 5].map((n) => file(`f${n}.jpg`))));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(3));
    expect(result.current.summary).toMatchObject({ uploading: 3, queued: 2 });
    expect(pending[0]?.input).toMatchObject({ purpose: "post", fileName: "f1.jpg" });
    act(() => pending[0]?.opts.onProgress?.({ loaded: 500, total: 1000, percent: 50 }));
    expect(result.current.state.items[0]?.upload.percent).toBe(50);
    await act(async () => pending[0]?.resolve(1));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(4));
    expect(result.current.summary).toMatchObject({ uploaded: 1, uploading: 3, queued: 1 });
    for (const [i, p] of pending.slice(1).entries()) await act(async () => p.resolve(i + 2));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(5));
    await act(async () => pending[4]?.resolve(5));
    await waitFor(() => expect(result.current.summary.ready).toBe(true));
    expect(result.current.summary.mediaIds).toEqual([1, 2, 3, 4, 5].map((n) => hexId("med", n)));
  });

  it("rejects bad files with per-file messages and caps the selection at 10", async () => {
    const { upload } = fakeUpload();
    const probeVideo = vi.fn().mockResolvedValue({ durationMs: 61_000, width: 10, height: 10 });
    const { result } = renderHook(() => usePostComposer({ upload, probeVideo }));
    await act(() =>
      result.current.addFiles([
        file("doc.pdf", "application/pdf"),
        file("big.jpg", "image/jpeg", 10 * 1024 * 1024 + 1),
        file("long.mp4", "video/mp4"),
        ...Array.from({ length: 11 }, (_, i) => file(`ok${i}.png`, "image/png")),
      ]),
    );
    expect(result.current.state.items).toHaveLength(10);
    expect(result.current.state.problems).toEqual([
      expect.stringMatching(/^doc\.pdf: Choose a JPEG/),
      "big.jpg: Images must be 10 MB or smaller.",
      "long.mp4: Videos must be 60 seconds or shorter.",
      tooManyFilesMessage(),
    ]);
    act(() => result.current.dismissProblems());
    expect(result.current.state.problems).toEqual([]);
  });

  it("sends video metadata with the upload", async () => {
    const { upload, pending } = fakeUpload();
    const probeVideo = vi.fn().mockResolvedValue({ durationMs: 12_345, width: 720, height: 1280 });
    const { result } = renderHook(() => usePostComposer({ upload, probeVideo }));
    await act(() => result.current.addFiles([file("clip.webm", "video/webm")]));
    await waitFor(() => expect(pending).toHaveLength(1));
    expect(pending[0]?.input).toMatchObject({ durationMs: 12_345, width: 720, height: 1280 });
    expect(result.current.state.items[0]?.kind).toBe("video");
  });

  it("marks failed uploads and retries them", async () => {
    const { upload, pending } = fakeUpload();
    const { result } = renderHook(() => usePostComposer({ upload }));
    await act(() => result.current.addFiles([file("a.jpg")]));
    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () =>
      pending[0]?.reject(
        new ApiError(415, {
          error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "x", request_id: "r" },
        } as never),
      ),
    );
    expect(result.current.state.items[0]?.upload).toMatchObject({
      status: "error",
      error: "That file type isn't supported.",
    });
    expect(result.current.summary.failed).toBe(1);
    act(() => result.current.retry(result.current.state.items[0]!.key));
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => pending[1]?.resolve(9));
    expect(result.current.summary.ready).toBe(true);
  });

  it("removing an item aborts its upload and frees the slot", async () => {
    const { upload, pending } = fakeUpload();
    const revokePreviewUrl = vi.fn();
    const { result } = renderHook(() =>
      usePostComposer({ upload, createPreviewUrl: (f) => `blob:${f.name}`, revokePreviewUrl }),
    );
    await act(() => result.current.addFiles([1, 2, 3, 4].map((n) => file(`f${n}.jpg`))));
    await waitFor(() => expect(pending).toHaveLength(3));
    act(() => result.current.remove(result.current.state.items[0]!.key));
    expect(pending[0]?.opts.signal?.aborted).toBe(true);
    expect(revokePreviewUrl).toHaveBeenCalledWith("blob:f1.jpg");
    await waitFor(() => expect(pending).toHaveLength(4));
    expect(result.current.state.items.map((i) => i.name)).toEqual(["f2.jpg", "f3.jpg", "f4.jpg"]);
  });

  it("survives StrictMode's simulated unmount by re-queueing aborted uploads", async () => {
    const { upload, pending } = fakeUpload();
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => usePostComposer({ upload }), { wrapper });
    await act(() => result.current.addFiles([file("a.jpg")]));
    await waitFor(() => expect(result.current.state.items[0]?.upload.status).toBe("uploading"));
    const live = pending[pending.length - 1];
    await act(async () => live?.resolve(3));
    await waitFor(() => expect(result.current.summary.ready).toBe(true));
  });
});
