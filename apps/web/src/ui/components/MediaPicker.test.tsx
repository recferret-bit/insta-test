import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ComposerItem } from "../../state/posts-composer";
import { INITIAL_UPLOAD_STATE } from "../../state/upload";
import { MediaPicker } from "./MediaPicker";

function item(key: string, overrides: Partial<ComposerItem> = {}): ComposerItem {
  return {
    key,
    file: new File(["x"], `${key}.jpg`, { type: "image/jpeg" }),
    name: `${key}.jpg`,
    kind: "image",
    previewUrl: `blob:${key}`,
    video: null,
    upload: INITIAL_UPLOAD_STATE,
    ...overrides,
  };
}

function renderPicker(items: ComposerItem[], props: Partial<Parameters<typeof MediaPicker>[0]> = {}) {
  const handlers = { onAdd: vi.fn(), onRemove: vi.fn(), onMove: vi.fn(), onRetry: vi.fn() };
  const result = render(<MediaPicker items={items} problems={[]} {...handlers} {...props} />);
  return { ...handlers, ...result };
}

describe("MediaPicker", () => {
  it("passes picked files on and restricts the accepted types", () => {
    const { onAdd, container } = renderPicker([]);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe("image/jpeg,image/png,image/webp,video/mp4,video/webm");
    expect(input.multiple).toBe(true);
    const f = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [f] } });
    expect(onAdd).toHaveBeenCalledWith([f]);
    expect(screen.getByRole("button", { name: "Select from computer" })).toBeTruthy();
  });

  it("accepts files dropped on the drop zone", () => {
    const { onAdd } = renderPicker([]);
    const f = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.drop(screen.getByTestId("media-drop-zone"), { dataTransfer: { files: [f] } });
    expect(onAdd).toHaveBeenCalledWith([f]);
  });

  it("reorders with keyboard buttons (disabled at the ends) and announces it", () => {
    const { onMove } = renderPicker([item("a"), item("b")]);
    const earlierA = screen.getByRole("button", {
      name: "Move Photo 1 (a.jpg) earlier",
    }) as HTMLButtonElement;
    expect(earlierA.disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Move Photo 2 (b.jpg) later" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Move Photo 1 (a.jpg) later" }));
    expect(onMove).toHaveBeenCalledWith("a", 1);
    expect(screen.getByText("Photo moved to position 2 of 2.")).toBeTruthy();
  });

  it("reorders by drag and drop", () => {
    const { onMove } = renderPicker([item("a"), item("b"), item("c")]);
    const tiles = screen.getAllByRole("listitem");
    fireEvent.dragStart(tiles[2]!, { dataTransfer: { setData: vi.fn() } });
    fireEvent.dragOver(tiles[0]!);
    fireEvent.drop(tiles[0]!);
    expect(onMove).toHaveBeenCalledWith("c", 0);
  });

  it("shows queued / progress / failed states with retry and removal", () => {
    const { onRetry, onRemove } = renderPicker([
      item("a"),
      item("b", { upload: { ...INITIAL_UPLOAD_STATE, status: "uploading", percent: 40 } }),
      item("c", { upload: { ...INITIAL_UPLOAD_STATE, status: "error", error: "That file is too large." } }),
      item("d", { upload: { ...INITIAL_UPLOAD_STATE, status: "success", percent: 100 } }),
    ]);
    expect(screen.getByText("Waiting…")).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Uploading Photo 2 (b.jpg)" });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByText("That file is too large.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledWith("c");
    expect(screen.getByRole("img", { name: "Photo 4 (d.jpg) uploaded" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Photo 1 (a.jpg)" }));
    expect(onRemove).toHaveBeenCalledWith("a");
  });

  it("lists pick problems and disables adding when 10 files are selected", () => {
    const onDismissProblems = vi.fn();
    renderPicker(
      Array.from({ length: 10 }, (_, i) => item(`k${i}`)),
      { problems: ["x.gif: Choose a JPEG"], onDismissProblems },
    );
    expect(screen.getByRole("alert").textContent).toContain("x.gif: Choose a JPEG");
    expect((screen.getByRole("button", { name: "Add more" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/10\/10 selected/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismissProblems).toHaveBeenCalled();
  });
});
