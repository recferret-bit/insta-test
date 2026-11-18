import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/http";
import type { UploadOptions } from "../api/media";
import { media } from "../test/fixtures";
import {
  acceptFor,
  checkUploadFile,
  INITIAL_UPLOAD_STATE,
  uploadErrorMessage,
  uploadReducer,
  useUpload,
  type UploadFn,
} from "./upload";

const MiB = 1024 * 1024;

function deferredUpload() {
  let resolve!: (value: ReturnType<typeof media>) => void;
  let reject!: (error: unknown) => void;
  let opts: UploadOptions = {};
  const fn = vi.fn<UploadFn>((_input, o = {}) => {
    opts = o;
    return new Promise((res, rej) => {
      resolve = res;
      reject = rej;
      o.signal?.addEventListener("abort", () => rej(new DOMException("Upload aborted", "AbortError")));
    });
  });
  return { fn, resolve: (v = media()) => resolve(v), reject: (e: unknown) => reject(e), opts: () => opts };
}

const file = () => new File(["abc"], "a.png", { type: "image/png" });

describe("uploadReducer", () => {
  it("walks idle → uploading → progress → success", () => {
    let s = uploadReducer(INITIAL_UPLOAD_STATE, { type: "start", total: 100 });
    expect(s).toMatchObject({ status: "uploading", percent: 0, total: 100 });
    s = uploadReducer(s, { type: "progress", loaded: 50, total: 100, percent: 50 });
    expect(s.percent).toBe(50);
    s = uploadReducer(s, { type: "success", media: { id: "m" } as never });
    expect(s).toMatchObject({ status: "success", percent: 100, loaded: 100 });
  });

  it("ignores progress and cancel outside an active upload", () => {
    expect(uploadReducer(INITIAL_UPLOAD_STATE, { type: "progress", loaded: 1, total: 2, percent: 50 })).toBe(
      INITIAL_UPLOAD_STATE,
    );
    expect(uploadReducer(INITIAL_UPLOAD_STATE, { type: "cancel" })).toBe(INITIAL_UPLOAD_STATE);
  });

  it("records errors and resets", () => {
    const started = uploadReducer(INITIAL_UPLOAD_STATE, { type: "start", total: 1 });
    const failed = uploadReducer(started, { type: "error", error: "boom", cause: 1 });
    expect(failed).toMatchObject({ status: "error", error: "boom", cause: 1 });
    expect(uploadReducer(failed, { type: "reset" })).toBe(INITIAL_UPLOAD_STATE);
  });
});

describe("file checks", () => {
  it("acceptFor limits avatars to images", () => {
    expect(acceptFor("avatar")).toBe("image/jpeg,image/png,image/webp");
    expect(acceptFor("post")).toBe("image/jpeg,image/png,image/webp,video/mp4,video/webm");
  });

  it.each([
    [{ type: "image/png", size: 10 * MiB }, "avatar", null],
    [{ type: "image/png", size: 10 * MiB + 1 }, "avatar", "Images must be 10 MB or smaller."],
    [{ type: "video/mp4", size: 1 }, "avatar", "Choose a JPEG, PNG or WebP image."],
    [{ type: "video/mp4", size: 50 * MiB }, "post", null],
    [{ type: "video/webm", size: 50 * MiB + 1 }, "story", "Videos must be 50 MB or smaller."],
    [{ type: "image/gif", size: 1 }, "post", "Choose a JPEG, PNG or WebP image, or an MP4 or WebM video."],
    [{ type: "image/jpeg", size: 0 }, "avatar", "That file is empty."],
  ] as const)("checkUploadFile(%j, %s)", (f, purpose, expected) => {
    expect(checkUploadFile(f, purpose)).toBe(expected);
  });

  it("maps 413/415 to specific messages", () => {
    const err = (status: number, code: "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE") =>
      new ApiError(status, { error: { code, message: "x", request_id: "r" } });
    expect(uploadErrorMessage(err(413, "PAYLOAD_TOO_LARGE"))).toBe("That file is too large.");
    expect(uploadErrorMessage(err(415, "UNSUPPORTED_MEDIA_TYPE"))).toBe("That file type isn't supported.");
    expect(uploadErrorMessage(new TypeError("net"))).toBe("Network error. Check your connection.");
  });
});

describe("useUpload", () => {
  it("reports progress and resolves with a MediaViewModel", async () => {
    const d = deferredUpload();
    const { result } = renderHook(() => useUpload(d.fn));
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.start({ file: file(), purpose: "avatar" });
    });
    expect(result.current.state.status).toBe("uploading");
    expect(d.fn.mock.calls[0]?.[0]).toMatchObject({ purpose: "avatar" });
    act(() => d.opts().onProgress?.({ loaded: 1, total: 3, percent: 33 }));
    expect(result.current.state.percent).toBe(33);
    await act(async () => {
      d.resolve(media({ purpose: "avatar" }));
      await expect(pending).resolves.toMatchObject({ purpose: "avatar", isVideo: false });
    });
    expect(result.current.state.status).toBe("success");
    expect(result.current.state.media?.purpose).toBe("avatar");
  });

  it("surfaces API errors with a readable message", async () => {
    const d = deferredUpload();
    const { result } = renderHook(() => useUpload(d.fn));
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.start({ file: file(), purpose: "post" });
    });
    await act(async () => {
      d.reject(new ApiError(413, { error: { code: "PAYLOAD_TOO_LARGE", message: "x", request_id: "r" } }));
      await expect(pending).resolves.toBeNull();
    });
    expect(result.current.state).toMatchObject({ status: "error", error: "That file is too large." });
  });

  it("cancel aborts the request and marks the upload canceled", async () => {
    const d = deferredUpload();
    const { result } = renderHook(() => useUpload(d.fn));
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.start({ file: file(), purpose: "post" });
    });
    await act(async () => {
      result.current.cancel();
      await expect(pending).resolves.toBeNull();
    });
    expect(d.opts().signal?.aborted).toBe(true);
    expect(result.current.state.status).toBe("canceled");
  });

  it("a new start supersedes the previous upload", async () => {
    const first = deferredUpload();
    const { result, rerender } = renderHook(({ fn }) => useUpload(fn), { initialProps: { fn: first.fn } });
    let p1!: Promise<unknown>;
    act(() => {
      p1 = result.current.start({ file: file(), purpose: "post" });
    });
    const firstSignal = first.opts().signal;
    const second = deferredUpload();
    rerender({ fn: second.fn });
    let p2!: Promise<unknown>;
    act(() => {
      p2 = result.current.start({ file: file(), purpose: "post" });
    });
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => {
      second.resolve(media({ id: media().id }));
      await expect(p1).resolves.toBeNull();
      await expect(p2).resolves.toMatchObject({ id: media().id });
    });
    expect(result.current.state.status).toBe("success");
  });

  it("unmount aborts an upload in flight", () => {
    const d = deferredUpload();
    const { result, unmount } = renderHook(() => useUpload(d.fn));
    act(() => {
      void result.current.start({ file: file(), purpose: "post" });
    });
    unmount();
    expect(d.opts().signal?.aborted).toBe(true);
  });
});
