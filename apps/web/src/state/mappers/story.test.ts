import { describe, expect, it } from "vitest";

import { hexId, media, NOW, story, trayItem, userSummary } from "../../test/fixtures";
import {
  STORY_IMAGE_DURATION_MS,
  toCreateStoryDto,
  toStoryTrayItemVM,
  toStoryViewerVM,
  toStoryVM,
} from "./story";

describe("story mappers", () => {
  it("images show for 5 s", () => {
    const vm = toStoryVM(story(), NOW);
    expect(vm.durationMs).toBe(STORY_IMAGE_DURATION_MS);
    expect(vm.remainingLabel).toBe("23h left");
    expect(vm.viewCountLabel).toBeNull();
  });

  it("videos use their duration; author sees view count", () => {
    const vm = toStoryVM(story({ media: media({ kind: "video", duration_ms: 12_000 }), view_count: 3 }), NOW);
    expect(vm.durationMs).toBe(12_000);
    expect(vm.viewCountLabel).toBe("Seen by 3");
  });

  it("a video without duration falls back to 5 s", () => {
    expect(toStoryVM(story({ media: media({ kind: "video", duration_ms: null }) }), NOW).durationMs).toBe(
      5000,
    );
  });

  it("tray item ring state and href", () => {
    expect(toStoryTrayItemVM(trayItem())).toMatchObject({
      ringState: "unseen",
      href: "/stories/alice",
      storyCountLabel: "2 stories",
    });
    expect(toStoryTrayItemVM(trayItem({ has_unseen: false, story_count: 1 }))).toMatchObject({
      ringState: "seen",
      storyCountLabel: "1 story",
    });
  });

  it("viewer row and create dto", () => {
    const vm = toStoryViewerVM({ user: userSummary(), viewed_at: "2026-11-17T11:00:00.000Z" }, NOW);
    expect(vm.viewedAtRelative).toBe("1h");
    expect(toCreateStoryDto(hexId("med", 1))).toEqual({ media_id: hexId("med", 1) });
  });
});
