import { describe, expect, it } from "vitest";

import { hexId, notification, NOW } from "../../test/fixtures";
import { toMarkReadDto, toNotificationVM } from "./notification";

describe("notification mapper", () => {
  it("like → post link, unread", () => {
    expect(toNotificationVM(notification(), NOW)).toMatchObject({
      message: "liked your post",
      href: `/p/${hexId("pst", 1)}`,
      isUnread: true,
      createdAtRelative: "5m",
    });
  });

  it("comment includes the (server-truncated) text", () => {
    const vm = toNotificationVM(
      notification({ type: "comment", comment_id: hexId("cmt", 1), comment_text: "Love it" }),
      NOW,
    );
    expect(vm.message).toBe("commented: Love it");
    expect(toNotificationVM(notification({ type: "comment", comment_text: null }), NOW).message).toBe(
      "commented on your post",
    );
  });

  it("follow → actor profile, read", () => {
    const vm = toNotificationVM(
      notification({
        type: "follow",
        post_id: null,
        post_thumbnail_url: null,
        read_at: "2026-11-17T11:59:00.000Z",
      }),
      NOW,
    );
    expect(vm).toMatchObject({ message: "started following you", href: "/u/bob", isUnread: false });
  });

  it("a like whose post is gone links to the actor", () => {
    expect(toNotificationVM(notification({ post_id: null }), NOW).href).toBe("/u/bob");
  });

  it("toMarkReadDto", () => {
    expect(toMarkReadDto(hexId("ntf", 9))).toEqual({ up_to_id: hexId("ntf", 9) });
  });
});
