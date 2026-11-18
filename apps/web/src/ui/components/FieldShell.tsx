import type { ReactNode } from "react";

import "./Field.css";

type FieldShellProps = {
  inputId: string;
  label: string;
  hideLabel?: boolean;
  error?: string | null;
  hint?: ReactNode;
  count?: number;
  max?: number;
  children: (describedBy: string | undefined) => ReactNode;
};

/** Shared label / hint / error / counter layout for `Input` and `TextArea`. */
export function FieldShell({
  inputId,
  label,
  hideLabel,
  error,
  hint,
  count,
  max,
  children,
}: FieldShellProps) {
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const counterId = count !== undefined ? `${inputId}-counter` : undefined;
  const describedBy = [errorId, hintId, counterId].filter(Boolean).join(" ") || undefined;
  const over = count !== undefined && max !== undefined && count > max;
  return (
    <div className={["field", error && "field--invalid"].filter(Boolean).join(" ")}>
      <label htmlFor={inputId} className={hideLabel ? "visually-hidden" : "field__label"}>
        {label}
      </label>
      {children(describedBy)}
      <div className="field__meta">
        {error ? (
          <p id={errorId} className="field__error">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="field__hint">
            {hint}
          </p>
        ) : (
          <span />
        )}
        {count !== undefined && (
          <span
            id={counterId}
            className={["field__counter", over && "field__counter--over"].filter(Boolean).join(" ")}
          >
            {max !== undefined ? `${count}/${max}` : count}
          </span>
        )}
      </div>
    </div>
  );
}
