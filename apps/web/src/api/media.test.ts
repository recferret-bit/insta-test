import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { media } from "../test/fixtures";
import { ApiError, configureHttp } from "./http";
import { buildUploadForm, uploadMedia, type UploadProgress } from "./media";

/** Minimal controllable XMLHttpRequest double. */
class FakeXhr {
  static last: FakeXhr | null = null;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: FormData | null = null;
  status = 0;
  responseText = "";
  responseHeaders: Record<string, string> = {};
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  aborted = false;

  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  getResponseHeader(name: string) {
    return this.responseHeaders[name] ?? null;
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  respond(status: number, body: unknown, headers: Record<string, string> = {}) {
    this.status = status;
    this.responseText = typeof body === "string" ? body : JSON.stringify(body);
    this.responseHeaders = headers;
    this.onload?.();
  }
  progress(loaded: number, total: number, lengthComputable = true) {
    this.upload.onprogress?.({ loaded, total, lengthComputable } as ProgressEvent);
  }
}

describe("api/media uploadMedia (XHR with progress)", () => {
  const onUnauthenticated = vi.fn();

  beforeEach(() => {
    FakeXhr.last = null;
    onUnauthenticated.mockReset();
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    configureHttp({
      baseUrl: "http://api.test",
      getToken: () => "tok",
      onUnauthenticated,
      validateResponses: true,
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("builds multipart parts: purpose, optional dims/duration, then the file", () => {
    const form = buildUploadForm({
      file: new Blob(["x"], { type: "video/mp4" }),
      fileName: "clip.mp4",
      purpose: "post",
      width: 1920.4,
      height: 1080,
      durationMs: 12_345.6,
    });
    expect([...form.keys()]).toEqual(["purpose", "width", "height", "duration_ms", "file"]);
    expect(form.get("width")).toBe("1920");
    expect(form.get("duration_ms")).toBe("12346");
    expect((form.get("file") as File).name).toBe("clip.mp4");
  });

  it("omits optional parts for images", () => {
    const form = buildUploadForm({ file: new Blob(["x"]), purpose: "avatar" });
    expect([...form.keys()]).toEqual(["purpose", "file"]);
  });

  it("POSTs to /api/v1/media with the bearer token, reports progress and resolves the MediaResponseDto", async () => {
    const progress: UploadProgress[] = [];
    const promise = uploadMedia(
      { file: new Blob(["x"]), purpose: "post" },
      { onProgress: (p) => progress.push(p) },
    );
    const xhr = FakeXhr.last!;
    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe("http://api.test/api/v1/media");
    expect(xhr.headers.Authorization).toBe("Bearer tok");
    expect(xhr.headers["Content-Type"]).toBeUndefined();
    xhr.progress(25, 100);
    xhr.progress(100, 100);
    xhr.progress(10, 0, false);
    const dto = media();
    xhr.respond(201, dto);
    await expect(promise).resolves.toEqual(dto);
    expect(progress).toEqual([
      { loaded: 25, total: 100, percent: 25 },
      { loaded: 100, total: 100, percent: 100 },
      { loaded: 10, total: 0, percent: null },
    ]);
  });

  it("rejects with ApiError for an error envelope", async () => {
    const promise = uploadMedia({ file: new Blob(["x"]), purpose: "post" });
    FakeXhr.last!.respond(415, {
      error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Unsupported", request_id: "req-1234" },
    });
    const error = (await promise.catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("notifies onUnauthenticated for 401 UNAUTHENTICATED", async () => {
    const promise = uploadMedia({ file: new Blob(["x"]), purpose: "post" });
    FakeXhr.last!.respond(401, { error: { code: "UNAUTHENTICATED", message: "No", request_id: "req-1234" } });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("aborts via AbortSignal", async () => {
    const controller = new AbortController();
    const promise = uploadMedia({ file: new Blob(["x"]), purpose: "post" }, { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeXhr.last!.aborted).toBe(true);
  });

  it("rejects immediately for an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      uploadMedia({ file: new Blob(["x"]), purpose: "post" }, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeXhr.last).toBeNull();
  });

  it("rejects with TypeError on network failure", async () => {
    const promise = uploadMedia({ file: new Blob(["x"]), purpose: "post" });
    FakeXhr.last!.onerror?.();
    await expect(promise).rejects.toBeInstanceOf(TypeError);
  });
});
