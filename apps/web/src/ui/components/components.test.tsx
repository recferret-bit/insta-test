import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearToasts, getToasts, showToast, TOAST_DURATION_MS } from "../../state/toast";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { ErrorState } from "./EmptyState";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { Skeleton } from "./Skeleton";
import { TextArea } from "./TextArea";
import { ToastRegion } from "./Toast";
import { UserRow } from "./UserRow";

describe("Button", () => {
  it("defaults to type=button and renders the variant class", () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toContain("btn--danger");
  });

  it("loading sets aria-busy, disables and blocks clicks", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Input / TextArea", () => {
  it("links label, error and counter via aria-describedby", () => {
    render(
      <Input
        label="Username"
        value="ali"
        onChange={() => undefined}
        maxLength={30}
        showCounter
        error="Taken"
      />,
    );
    const input = screen.getByLabelText("Username");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby")!.split(" ");
    const texts = describedBy.map((id) => document.getElementById(id)!.textContent);
    expect(texts).toEqual(["Taken", "3/30"]);
  });

  it("shows the hint when there is no error", () => {
    render(<TextArea label="Bio" hint="Up to 150 characters" value="" onChange={() => undefined} />);
    const area = screen.getByLabelText("Bio");
    expect(area.tagName).toBe("TEXTAREA");
    expect(document.getElementById(area.getAttribute("aria-describedby")!)!.textContent).toBe(
      "Up to 150 characters",
    );
    expect(area.hasAttribute("aria-invalid")).toBe(false);
  });
});

describe("Avatar", () => {
  it("renders size and ring state", () => {
    const { container } = render(<Avatar src="/a.png" alt="alice" size={56} ring="unseen" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.dataset.ring).toBe("unseen");
    expect(wrapper.style.width).toBe("56px");
    expect(screen.getByAltText("alice").getAttribute("src")).toBe("/a.png");
  });
});

describe("UserRow", () => {
  it("links to the profile and renders the action", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UserRow
          user={{ username: "bob", fullName: "Bob B", avatarUrl: "/b.png", profilePath: "/u/bob" }}
          action={<button type="button">Follow</button>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link").getAttribute("href")).toBe("/u/bob");
    expect(screen.getByText("Bob B")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Follow" })).toBeTruthy();
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive tech", () => {
    const { container } = render(<Skeleton circle width={44} height={44} />);
    expect((container.firstElementChild as HTMLElement).getAttribute("aria-hidden")).toBe("true");
  });
});

describe("ErrorState", () => {
  it("announces and retries", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Network error" onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("Network error");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("Modal", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <Modal open={open} onClose={() => setOpen(false)} title="Followers">
          <button type="button">First</button>
          <button type="button">Last</button>
        </Modal>
      </>
    );
  }

  it("is a labelled dialog that traps focus, closes on Esc and restores focus", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Followers" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    const close = screen.getByRole("button", { name: "Close" });
    expect(document.activeElement).toBe(close);

    const last = screen.getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on backdrop click but not on panel click", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ToastRegion", () => {
  afterEach(() => {
    clearToasts();
    vi.useRealTimers();
  });

  it("renders toasts politely and auto-dismisses after 4 s, pausing on hover", () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastRegion />
      </MemoryRouter>,
    );
    act(() => {
      showToast("Saved");
    });
    const toast = screen.getByText("Saved").closest("li")!;
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1000));
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(10_000));
    expect(getToasts()).toHaveLength(1);
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(1000));
    expect(getToasts()).toHaveLength(0);
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("dismisses on the close button", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastRegion />
      </MemoryRouter>,
    );
    act(() => {
      showToast("Hello", { href: "/notifications" });
    });
    expect(screen.getByRole("link", { name: "Hello" }).getAttribute("href")).toBe("/notifications");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Hello")).toBeNull();
  });
});
