import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

import type { MediaViewModel } from "../../state/mappers/media";
import { acceptFor, checkUploadFile, useUpload, type UploadFn } from "../../state/upload";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { UploadProgress } from "./UploadProgress";
import "./AvatarUploader.css";

export type AvatarUploaderProps = {
  /** Avatar currently shown (uploaded preview, saved avatar, or the generated initials avatar). */
  src: string;
  /** Whether a real (non-generated) avatar is shown, i.e. "Remove photo" makes sense. */
  hasAvatar: boolean;
  username: string;
  /** Called with the uploaded `avatar` media; the caller sends its id with `PATCH /me`. */
  onUploaded: (media: MediaViewModel) => void;
  onRemove: () => void;
  /** Reports whether an upload is in flight (the form disables "Save" meanwhile). */
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  /** Server-side error for the avatar field (e.g. `422 MEDIA_INVALID`). */
  error?: string | null;
  /** Injectable for tests. */
  upload?: UploadFn;
};

/** Profile photo picker (F-FE-07): uploads immediately with purpose `avatar`, shows progress, cancel and retry. */
export function AvatarUploader({
  src,
  hasAvatar,
  username,
  onUploaded,
  onRemove,
  onBusyChange,
  disabled = false,
  error,
  upload,
}: AvatarUploaderProps) {
  const inputId = `avatar-${useId()}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFile = useRef<File | null>(null);
  const { state, start, cancel, reset } = useUpload(upload);
  const [fileError, setFileError] = useState<string | null>(null);
  const busy = state.status === "uploading";

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  async function send(file: File) {
    lastFile.current = file;
    const media = await start({ file, fileName: file.name, purpose: "avatar" });
    if (media) onUploaded(media);
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow re-picking the same file after an error.
    event.target.value = "";
    if (!file) return;
    const problem = checkUploadFile(file, "avatar");
    setFileError(problem);
    if (problem) {
      reset();
      return;
    }
    void send(file);
  }

  function retry() {
    if (lastFile.current) void send(lastFile.current);
  }

  const shownError = fileError ?? (state.status === "error" ? null : error) ?? null;

  return (
    <div className="avatar-uploader">
      <Avatar src={src} alt={`Profile photo of @${username}`} size={88} />
      <div className="avatar-uploader__body">
        <p className="avatar-uploader__name">@{username}</p>
        <div className="avatar-uploader__actions">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={acceptFor("avatar")}
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onPick}
            disabled={disabled || busy}
            data-testid="avatar-file-input"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
          >
            Change photo
          </Button>
          {hasAvatar ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFileError(null);
                reset();
                onRemove();
              }}
              disabled={disabled || busy}
            >
              Remove photo
            </Button>
          ) : null}
        </div>
        <UploadProgress
          state={state}
          label="Uploading profile photo"
          onCancel={cancel}
          onRetry={lastFile.current ? retry : undefined}
        />
        {shownError ? (
          <p className="avatar-uploader__error" role="alert">
            {shownError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
