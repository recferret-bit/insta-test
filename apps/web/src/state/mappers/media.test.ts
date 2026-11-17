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
