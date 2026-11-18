import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UploadProgress } from "./UploadProgress";

describe("UploadProgress", () => {
  it("renders nothing when idle or finished", () => {
    const { container, rerender } = render(
      <UploadProgress state={{ status: "idle", percent: null, error: null }} label="Uploading" />,
    );
    expect(container.innerHTML).toBe("");
    rerender(<UploadProgress state={{ status: "success", percent: 100, error: null }} label="Uploading" />);
    expect(container.innerHTML).toBe("");
  });

  it("exposes the percentage via aria-valuenow", () => {
    render(
      <UploadProgress state={{ status: "uploading", percent: 42, error: null }} label="Uploading photo" />,
    );
    const bar = screen.getByRole("progressbar", { name: "Uploading photo" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.getAttribute("aria-valuetext")).toBe("42%");
  });

  it("is indeterminate while the total is unknown", () => {
    render(<UploadProgress state={{ status: "uploading", percent: null, error: null }} label="Uploading" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.className).toContain("indeterminate");
  });

  it("offers cancel while uploading", () => {
    const onCancel = vi.fn();
    render(
      <UploadProgress
        state={{ status: "uploading", percent: 0, error: null }}
        label="Uploading"
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows the error with retry", () => {
    const onRetry = vi.fn();
    render(
      <UploadProgress
        state={{ status: "error", percent: 10, error: "That file is too large." }}
        label="Uploading"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("That file is too large.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
