import { ArrowLeft, ArrowRight, Check, Film, ImagePlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";

import type { ComposerItem } from "../../state/posts-composer";
import { POST_MEDIA_MAX } from "../../state/posts-composer";
import { acceptFor } from "../../state/upload";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { UploadProgress } from "./UploadProgress";
import "./MediaPicker.css";

export type MediaPickerProps = {
  items: readonly ComposerItem[];
  problems: readonly string[];
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, to: number) => void;
  onRetry: (key: string) => void;
  onDismissProblems?: () => void;
  disabled?: boolean;
};

type FocusRequest = { key: string; control: "earlier" | "later" } | null;

function itemLabel(item: ComposerItem, index: number): string {
  return `${item.kind === "video" ? "Video" : "Photo"} ${index + 1} (${item.name})`;
}

/**
 * Composer media picker (F-FE-04): file input + drop zone, previews in display order, reorder by drag & drop or the
 * "Move earlier/later" buttons, per-file upload progress with retry, and remove.
 */
export function MediaPicker({
  items,
  problems,
  onAdd,
  onRemove,
  onMove,
  onRetry,
  onDismissProblems,
  disabled = false,
}: MediaPickerProps) {
  const inputId = `media-picker-${useId()}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [focusRequest, setFocusRequest] = useState<FocusRequest>(null);
  const full = items.length >= POST_MEDIA_MAX;

  // Keep keyboard focus on the moved item's control (its DOM node is re-ordered by React).
  useEffect(() => {
    if (!focusRequest || !listRef.current) return;
    const tile = listRef.current.querySelector<HTMLElement>(`[data-key="${focusRequest.key}"]`);
    const wanted = tile?.querySelector<HTMLButtonElement>(`[data-control="${focusRequest.control}"]`);
    const fallback = tile?.querySelector<HTMLButtonElement>(
      `[data-control="${focusRequest.control === "earlier" ? "later" : "earlier"}"]`,
    );
    (wanted && !wanted.disabled ? wanted : fallback)?.focus();
    setFocusRequest(null);
  }, [focusRequest, items]);

  const move = (item: ComposerItem, from: number, to: number, control: "earlier" | "later" | null) => {
    if (to < 0 || to >= items.length || to === from) return;
    onMove(item.key, to);
    setAnnouncement(
      `${item.kind === "video" ? "Video" : "Photo"} moved to position ${to + 1} of ${items.length}.`,
    );
    if (control) setFocusRequest({ key: item.key, control });
  };

  const addFiles = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length > 0) onAdd(files);
  };

  const onDropZone = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropActive(false);
    if (dragKey) return; // re-ordering, not adding
    if (!disabled && !full) addFiles(event.dataTransfer?.files ?? null);
  };

  return (
    <div className="media-picker">
      <div
        className={["media-picker__drop", dropActive && "media-picker__drop--active"]
          .filter(Boolean)
          .join(" ")}
        onDragOver={(event) => {
          if (dragKey || disabled || full) return;
          event.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={onDropZone}
        data-testid="media-drop-zone"
      >
        <Icon icon={ImagePlus} size={items.length ? 24 : 48} strokeWidth={1.5} />
        {items.length === 0 ? <p className="media-picker__hint">Drag photos and videos here</p> : null}
        <input
          ref={inputRef}
          id={inputId}
          className="visually-hidden"
          type="file"
          multiple
          accept={acceptFor("post")}
          disabled={disabled || full}
          onChange={(event) => {
            addFiles(event.target.files);
            // Allow picking the same file again after removing it.
            event.target.value = "";
          }}
          aria-describedby={`${inputId}-rules`}
          tabIndex={-1}
        />
        <Button
          variant={items.length ? "secondary" : "primary"}
          size={items.length ? "sm" : "md"}
          disabled={disabled || full}
          onClick={() => inputRef.current?.click()}
        >
          {items.length ? "Add more" : "Select from computer"}
        </Button>
        <p id={`${inputId}-rules`} className="media-picker__rules">
          {`Up to ${POST_MEDIA_MAX} JPEG, PNG or WebP photos (10 MB) or MP4/WebM videos (50 MB, 60 s). ${items.length}/${POST_MEDIA_MAX} selected.`}
        </p>
      </div>

      {problems.length > 0 ? (
        <div className="media-picker__problems" role="alert">
          <ul>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
          {onDismissProblems ? (
            <button
              type="button"
              className="media-picker__dismiss"
              onClick={onDismissProblems}
              aria-label="Dismiss"
            >
              <Icon icon={X} size={16} />
            </button>
          ) : null}
        </div>
      ) : null}

      {items.length > 0 ? (
        <ol ref={listRef} className="media-picker__list" aria-label="Selected media (in posting order)">
          {items.map((item, index) => {
            const label = itemLabel(item, index);
            const status = item.upload.status;
            return (
              <li
                key={item.key}
                data-key={item.key}
                className={["media-picker__tile", dragKey === item.key && "media-picker__tile--dragging"]
                  .filter(Boolean)
                  .join(" ")}
                draggable={!disabled}
                onDragStart={(event) => {
                  setDragKey(item.key);
                  event.dataTransfer?.setData("text/plain", item.key);
                  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDragKey(null)}
                onDragOver={(event) => {
                  if (dragKey && dragKey !== item.key) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const from = items.findIndex((i) => i.key === dragKey);
                  const dragged = items[from];
                  if (dragged) move(dragged, from, index, null);
                  setDragKey(null);
                }}
              >
                <div className="media-picker__preview">
                  {item.kind === "video" ? (
                    <video
                      src={item.previewUrl || undefined}
                      muted
                      playsInline
                      preload="metadata"
                      aria-label={label}
                    />
                  ) : (
                    <img src={item.previewUrl || undefined} alt={label} />
                  )}
                  <span className="media-picker__position" aria-hidden="true">
                    {index + 1}
                  </span>
                  {item.kind === "video" ? (
                    <span className="media-picker__kind" aria-hidden="true">
                      <Icon icon={Film} size={16} />
                    </span>
                  ) : null}
                  {status === "success" ? (
                    <span className="media-picker__done" role="img" aria-label={`${label} uploaded`}>
                      <Icon icon={Check} size={14} />
                    </span>
                  ) : null}
                </div>
                <div className="media-picker__status">
                  {status === "idle" ? <span className="media-picker__waiting">Waiting…</span> : null}
                  <UploadProgress
                    state={item.upload}
                    label={`Uploading ${label}`}
                    onRetry={() => onRetry(item.key)}
                  />
                  {status === "canceled" ? (
                    <button type="button" className="media-picker__retry" onClick={() => onRetry(item.key)}>
                      Retry
                    </button>
                  ) : null}
                </div>
                <div className="media-picker__controls">
                  <button
                    type="button"
                    data-control="earlier"
                    aria-label={`Move ${label} earlier`}
                    disabled={disabled || index === 0}
                    onClick={() => move(item, index, index - 1, "earlier")}
                  >
                    <Icon icon={ArrowLeft} size={16} />
                  </button>
                  <button
                    type="button"
                    data-control="later"
                    aria-label={`Move ${label} later`}
                    disabled={disabled || index === items.length - 1}
                    onClick={() => move(item, index, index + 1, "later")}
                  >
                    <Icon icon={ArrowRight} size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    disabled={disabled}
                    onClick={() => {
                      onRemove(item.key);
                      setAnnouncement(`${label} removed.`);
                    }}
                  >
                    <Icon icon={X} size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
