import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { media } from "../../test/fixtures";
import type { UploadFn } from "../../state/upload";
import { AvatarUploader } from "./AvatarUploader";

function pick(file: File) {
  const input = screen.getByTestId("avatar-file-input") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

const png = () => new File(["png"], "me.png", { type: "image/png" });

function setup(upload: UploadFn, props: Partial<Parameters<typeof AvatarUploader>[0]> = {}) {
  const onUploaded = vi.fn();
  const onRemove = vi.fn();
  const onBusyChange = vi.fn();
  render(
    <AvatarUploader
      src="data:image/svg+xml,x"
      hasAvatar={false}
      username="alice"
      upload={upload}
      onUploaded={onUploaded}
      onRemove={onRemove}
      onBusyChange={onBusyChange}
      {...props}
    />,
  );
  return { onUploaded, onRemove, onBusyChange };
}

describe("AvatarUploader", () => {
  it("uploads a picked image with purpose avatar and reports the media", async () => {
    let finish!: () => void;
    const upload = vi.fn<UploadFn>(
      (_input, opts) =>
        new Promise((resolve) => {
          opts?.onProgress?.({ loaded: 1, total: 2, percent: 50 });
          finish = () => resolve(media({ purpose: "avatar", url: "http://api.test/media/new.png" }));
        }),
    );
    const { onUploaded, onBusyChange } = setup(upload);
    pick(png());
    expect(upload.mock.calls[0]?.[0]).toMatchObject({ purpose: "avatar", fileName: "me.png" });
    expect(
      screen.getByRole("progressbar", { name: "Uploading profile photo" }).getAttribute("aria-valuenow"),
    ).toBe("50");
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    expect((screen.getByRole("button", { name: "Change photo" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish());
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(onUploaded.mock.calls[0]?.[0]).toMatchObject({ url: "http://api.test/media/new.png" });
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("rejects non-image files without uploading", () => {
    const upload = vi.fn<UploadFn>();
    const { onUploaded } = setup(upload);
    pick(new File(["v"], "clip.mp4", { type: "video/mp4" }));
    expect(upload).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Choose a JPEG, PNG or WebP image.");
  });

  it("shows upload failures with retry", async () => {
    const upload = vi
      .fn<UploadFn>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(media({ purpose: "avatar" }));
    const { onUploaded } = setup(upload);
    pick(png());
    await screen.findByText("Network error. Check your connection.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(upload).toHaveBeenCalledTimes(2);
  });

  it("offers remove only when a real avatar is shown", () => {
    const { onRemove } = setup(vi.fn<UploadFn>(), { hasAvatar: true });
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("hides remove for the generated avatar and shows a server error", () => {
    setup(vi.fn<UploadFn>(), { error: "Media is invalid" });
    expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Media is invalid");
    expect(screen.getByRole("img", { name: "Profile photo of @alice" })).toBeTruthy();
  });
});
