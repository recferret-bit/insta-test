import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from "react";

import { FieldShell } from "./FieldShell";

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hideLabel?: boolean;
  error?: string | null;
  hint?: ReactNode;
  showCounter?: boolean;
};

/** Multi-line field (captions, bio, comments) with the same label/error/counter contract as `Input`. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hideLabel, error, hint, showCounter, id, className, value, maxLength, rows = 3, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? `ta-${autoId}`;
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
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={["field__control", "field__control--multiline", className].filter(Boolean).join(" ")}
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
