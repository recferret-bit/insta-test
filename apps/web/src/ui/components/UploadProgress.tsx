import { X } from "lucide-react";

import type { UploadState } from "../../state/upload";
import { Icon } from "./Icon";
import "./UploadProgress.css";

export type UploadProgressProps = {
  state: Pick<UploadState, "status" | "percent" | "error">;
  /** Accessible name of the progress bar, e.g. "Uploading profile photo". */
  label: string;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
};

/**
 * Upload progress bar (design-system "Live regions: upload progress (`aria-valuenow`)").
 * Renders nothing when idle or finished; shows an indeterminate bar while the total size is unknown.
 */
export function UploadProgress({ state, label, onCancel, onRetry, className }: UploadProgressProps) {
  const classes = ["upload-progress", className].filter(Boolean).join(" ");
  if (state.status === "uploading") {
    const known = state.percent !== null;
    return (
      <div className={classes}>
        <div
          className={["upload-progress__track", !known && "upload-progress__track--indeterminate"]
            .filter(Boolean)
            .join(" ")}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={known ? (state.percent ?? 0) : undefined}
          aria-valuetext={known ? `${state.percent}%` : "Uploading"}
        >
          <span className="upload-progress__bar" style={known ? { width: `${state.percent}%` } : undefined} />
        </div>
        <span className="upload-progress__label" aria-hidden="true">
          {known ? `${state.percent}%` : "…"}
        </span>
        {onCancel ? (
          <button
            type="button"
            className="upload-progress__cancel"
            onClick={onCancel}
            aria-label="Cancel upload"
          >
            <Icon icon={X} size={16} />
          </button>
        ) : null}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className={classes} role="alert">
        <span className="upload-progress__error">{state.error ?? "Upload failed."}</span>
        {onRetry ? (
          <button type="button" className="upload-progress__retry" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    );
  }
  return null;
}
