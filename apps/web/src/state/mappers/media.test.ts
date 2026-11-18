import { describe, expect, it } from "vitest";

import { media } from "../../test/fixtures";
import { ASPECT_RATIO_MAX, ASPECT_RATIO_MIN, clampAspectRatio, toMediaVM } from "./media";

describe("media mapper", () => {
  it("maps fields and flags videos", () => {
    const vm = toMediaVM(media({ kind: "video", mime_type: "video/mp4", duration_ms: 3000 }));
    expect(vm).toMatchObject({ isVideo: true, kind: "video", mimeType: "video/mp4", durationMs: 3000 });
  });

  it.each([
    [1080, 1350, 0.8],
    [1080, 1080, 1],
    [1080, 2400, ASPECT_RATIO_MIN],
    [4000, 1000, ASPECT_RATIO_MAX],
    [null, 100, 1],
    [100, 0, 1],
  ])("clampAspectRatio(%s, %s) = %s", (w, h, ratio) => {
    expect(clampAspectRatio(w, h)).toBeCloseTo(ratio);
  });
});

describe("media mapper — W01-01 coverage", () => {
  it("maps every image field", () => {
    expect(toMediaVM(media())).toEqual({
      id: media().id,
      kind: "image",
      isVideo: false,
      purpose: "post",
      mimeType: "image/jpeg",
      url: "http://api.test/media/2026/11/x.jpg",
      width: 1080,
      height: 1350,
      durationMs: null,
      aspectRatio: 0.8,
    });
  });

  it("uses a square frame for videos without declared dimensions", () => {
    const vm = toMediaVM(
      media({ kind: "video", mime_type: "video/webm", width: null, height: null, duration_ms: 60000 }),
    );
    expect(vm.aspectRatio).toBe(1);
    expect(vm.purpose).toBe("post");
  });

  it.each([
    [4, 5, ASPECT_RATIO_MIN],
    [191, 100, ASPECT_RATIO_MAX],
    [1, 8192, ASPECT_RATIO_MIN],
    [8192, 1, ASPECT_RATIO_MAX],
    [-10, 10, 1],
  ])("clamps boundary %s×%s to %s", (w, h, ratio) => {
    expect(clampAspectRatio(w, h)).toBeCloseTo(ratio, 10);
  });
});
