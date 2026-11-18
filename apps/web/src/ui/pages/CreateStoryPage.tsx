import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";

import { errorMessage } from "../../state/errors";
import { checkStoryFile, useCreateStoryMutation, type VideoDurationProbe } from "../../state/stories";
import { showToast } from "../../state/toast";
import { acceptFor, useUpload, type UploadFn } from "../../state/upload";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { UploadProgress } from "../components/UploadProgress";
import { useDocumentTitle } from "../layout/useDocumentTitle";
import "./CreateStoryPage.css";

type Picked = { file: File; previewUrl: string | null; isVideo: boolean };

function objectUrl(file: File): string | null {
  return typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
}

export type CreateStoryPageProps = {
  /** Injectable for tests. */
  upload?: UploadFn;
  probeDuration?: VideoDurationProbe;
};

/**
 * `/create/story` (auth required) — F-FE-09: pick one image or video, upload it with purpose `story` (progress,
 * cancel, retry), preview it, then `POST /stories`. Stories disappear after 24 hours.
 */
export function CreateStoryPage({ upload, probeDuration }: CreateStoryPageProps = {}) {
  useDocumentTitle("Add to story");
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, start, cancel, reset } = useUpload(upload);
  const create = useCreateStoryMutation();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Release the preview blob when it is replaced or the page unmounts.
  useEffect(() => {
    const url = picked?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [picked]);

  function send(file: File) {
    create.reset();
    void start({ file, fileName: file.name, purpose: "story" });
  }

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow re-picking the same file after an error.
    event.target.value = "";
    if (!file) return;
    reset();
    create.reset();
    setPicked(null);
    setChecking(true);
    const problem = await checkStoryFile(file, probeDuration);
    setChecking(false);
    setFileError(problem);
    if (problem) return;
    setPicked({ file, previewUrl: objectUrl(file), isVideo: file.type.startsWith("video/") });
    send(file);
  }

  function share() {
    const media = state.media;
    if (!media || create.isPending) return;
    create.mutate(media.id, {
      onSuccess: () => {
        showToast("Added to your story", { tone: "success" });
        navigate("/", { replace: true });
      },
    });
  }

  const uploading = state.status === "uploading";
  const previewSrc = picked?.previewUrl ?? state.media?.url ?? null;
  const canShare = state.status === "success" && state.media !== null;

  return (
    <section className="page page--narrow create-story">
      <h1 className="create-story__title">Add to your story</h1>
      <p className="text-muted create-story__hint">
        Share a photo or a video up to 60 seconds. Stories disappear after 24 hours.
      </p>

      <div className="create-story__preview" aria-busy={uploading || checking || undefined}>
        {picked && previewSrc ? (
          picked.isVideo ? (
            <video
              className="create-story__media"
              src={previewSrc}
              muted
              playsInline
              controls
              aria-label="Story preview"
            />
          ) : (
            <img className="create-story__media" src={previewSrc} alt="Story preview" />
          )
        ) : (
          <button
            type="button"
            className="create-story__pick"
            onClick={() => inputRef.current?.click()}
            disabled={checking}
          >
            <Icon icon={ImagePlus} size={40} strokeWidth={1.5} />
            <span>{checking ? "Checking file…" : "Choose a photo or video"}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={acceptFor("story")}
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void onPick(event)}
        data-testid="story-file-input"
      />

      <UploadProgress
        state={state}
        label="Uploading story"
        onCancel={cancel}
        onRetry={picked ? () => send(picked.file) : undefined}
      />
      {fileError ? (
        <p className="create-story__error" role="alert">
          {fileError}
        </p>
      ) : null}
      {create.isError ? (
        <p className="create-story__error" role="alert">
          {errorMessage(create.error)}
        </p>
      ) : null}

      <div className="create-story__actions">
        {picked ? (
          <Button
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || checking || create.isPending}
          >
            Choose another
          </Button>
        ) : null}
        <Button onClick={share} disabled={!canShare} loading={create.isPending}>
          Share to story
        </Button>
      </div>
    </section>
  );
}
