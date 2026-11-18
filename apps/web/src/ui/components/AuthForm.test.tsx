import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "./AuthForm";

function renderForm(props: Partial<Parameters<typeof AuthForm>[0]> = {}) {
  const onSubmit = vi.fn();
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <AuthForm
        title="Log in"
        submitLabel="Log in"
        onSubmit={onSubmit}
        footer={<span>Footer</span>}
        {...props}
      >
        <input aria-label="Field" />
      </AuthForm>
    </MemoryRouter>,
  );
  return { onSubmit };
}

describe("AuthForm", () => {
  it("renders a labelled card with the fields and footer", () => {
    renderForm({ subtitle: "Welcome back" });
    expect(screen.getByRole("heading", { level: 1, name: "Log in" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Log in" })).toBeTruthy();
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByLabelText("Field")).toBeTruthy();
    expect(screen.getByText("Footer")).toBeTruthy();
  });

  it("submits without a page reload", () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("blocks submit while submitting", () => {
    const { onSubmit } = renderForm({ submitting: true });
    const button = screen.getByRole("button", { name: /Log in/ });
    expect(button.getAttribute("aria-busy")).toBe("true");
    fireEvent.submit(button.closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("announces and focuses the form error", () => {
    renderForm({ formError: "Invalid credentials" });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Invalid credentials");
    expect(document.activeElement).toBe(alert);
  });
});
