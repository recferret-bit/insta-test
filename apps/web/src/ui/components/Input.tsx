import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

import { FieldShell } from "./FieldShell";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  /** Hide the label visually (still announced). */
  hideLabel?: boolean;
  error?: string | null;
  hint?: ReactNode;
  /** Show a `current/max` counter (uses `maxLength` when not given). */
  showCounter?: boolean;
};

/** Text input with label, hint/error linked by `aria-describedby`, and an optional character counter. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel, error, hint, showCounter, id, className, value, maxLength, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? `in-${autoId}`;
  return (
    <FieldShell
      inputId={inputId}
      label={label}
      hideLabel={hideLabel}
      error={error}
      hint={hint}
      count={showCounter && typeof value === "string" ? Array.from(value).length : undefined}
      max={maxLength}
    >
      {(describedBy) => (
        <input
          ref={ref}
          id={inputId}
          className={["field__control", className].filter(Boolean).join(" ")}
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FieldShell>
  );
});
