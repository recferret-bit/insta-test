import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { toMediaVM } from "../../state/mappers/media";
import { hexId, media } from "../../test/fixtures";
import { MediaCarousel } from "./MediaCarousel";

const three = [1, 2, 3].map((n) =>
  toMediaVM(
    media({
      id: hexId("med", n),
      ...(n === 3 ? { kind: "video", mime_type: "video/mp4", duration_ms: 5000 } : {}),
    }),
  ),
);

const track = () => screen.getByTestId("carousel-viewport").firstElementChild as HTMLElement;

beforeAll(() => {
  // jsdom has no PointerEvent: without it testing-library drops clientX/pointerType.
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      readonly pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerType = init.pointerType ?? "mouse";
      }
    }
    window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
  }
});

describe("MediaCarousel", () => {
  it("navigates with arrow buttons and hides them at the ends", () => {
    render(<MediaCarousel media={three} altText="Beach" />);
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(track().style.transform).toBe("translateX(-100%)");
    expect(screen.getByText("Slide 2 of 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(track().style.transform).toBe("translateX(-100%)");
  });

  it("supports ←/→ keys and labels slides 'n of N'", () => {
    render(<MediaCarousel media={three} altText="Beach" label="Media" />);
    const region = screen.getByRole("region", { name: "Media" });
    fireEvent.keyDown(region, { key: "ArrowRight" });
    fireEvent.keyDown(region, { key: "ArrowRight" });
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(track().style.transform).toBe("translateX(-200%)");
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(track().style.transform).toBe("translateX(-100%)");
    const slides = within(region).getAllByRole("group", { hidden: true });
    expect(slides.map((s) => s.getAttribute("aria-label"))).toEqual(["1 of 3", "2 of 3", "3 of 3"]);
    expect(slides[1]?.getAttribute("aria-hidden")).toBe("false");
  });

  it("swipes with pointer gestures past the threshold", () => {
    render(<MediaCarousel media={three} altText="Beach" />);
    const viewport = screen.getByTestId("carousel-viewport");
    fireEvent.pointerDown(viewport, { clientX: 200, clientY: 10 });
    fireEvent.pointerUp(viewport, { clientX: 100, clientY: 12 });
    expect(track().style.transform).toBe("translateX(-100%)");
    fireEvent.pointerDown(viewport, { clientX: 100, clientY: 10 });
    fireEvent.pointerUp(viewport, { clientX: 120, clientY: 10 });
    expect(track().style.transform).toBe("translateX(-100%)");
  });

  it("treats two quick touch taps as a double-tap", () => {
    const onDouble = vi.fn();
    render(<MediaCarousel media={three} altText="Beach" onDoubleActivate={onDouble} />);
    const viewport = screen.getByTestId("carousel-viewport");
    for (let i = 0; i < 2; i++) {
      fireEvent.pointerDown(viewport, { clientX: 50, clientY: 50, pointerType: "touch" });
      fireEvent.pointerUp(viewport, { clientX: 50, clientY: 50, pointerType: "touch" });
    }
    expect(onDouble).toHaveBeenCalledTimes(1);
    // The echoed dblclick some mobile browsers send afterwards is ignored.
    fireEvent.doubleClick(viewport);
    expect(onDouble).toHaveBeenCalledTimes(1);
  });

  it("fires onDoubleActivate on double-click, not on the arrow buttons", () => {
    const onDouble = vi.fn();
    render(<MediaCarousel media={three} altText="Beach" onDoubleActivate={onDouble} />);
    fireEvent.doubleClick(screen.getByRole("button", { name: "Next" }));
    expect(onDouble).not.toHaveBeenCalled();
    fireEvent.doubleClick(screen.getByTestId("carousel-viewport"));
    expect(onDouble).toHaveBeenCalledTimes(1);
  });

  it("renders a single image without carousel controls, and videos muted with an unmute toggle", () => {
    const { unmount } = render(<MediaCarousel media={three.slice(0, 1)} altText="Beach" />);
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.getByRole("img", { name: "Beach" })).toBeTruthy();
    unmount();
    render(<MediaCarousel media={three.slice(2)} altText="Clip" />);
    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Unmute video" }));
    expect(screen.getByRole("button", { name: "Mute video" })).toBeTruthy();
  });
});
