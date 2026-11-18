/**
 * Generic media upload hook with progress & cancel (frontend/01 "CreatePostPage": `XMLHttpRequest.upload.onprogress`).
 * Used by the avatar uploader (purpose `avatar`, w01) and reused by the post composer (w02) and story composer (w04).
 *
 * The hook resolves to a `MediaViewModel` (never a raw `MediaResponseDto`). One hook instance tracks one upload;
 * starting a new upload aborts the previous one, and unmounting aborts any upload in flight.
 */
import { LIMITS, type MediaPurposeDto } from "@insta/contracts";
import { useCallback, useEffect, useReducer, useRef } from "react";

import { uploadMedia, type UploadMediaInput } from "../api/media";
import { errorMessage } from "./errors";
import { toMediaVM, type MediaViewModel } from "./mappers/media";

export type UploadStatus = "idle" | "uploading" | "success" | "error" | "canceled";

export type UploadState = {
  status: UploadStatus;
  /** 0–100; `null` while the total size is unknown. */
  percent: number | null;
  loaded: number;
  total: number;
  media: MediaViewModel | null;
  error: string | null;
  /** The raw error (e.g. `ApiError` for `413`/`415`/`VALIDATION_FAILED`) for callers that map codes. */
  cause: unknown;
};

export type UploadAction =
  | { type: "start"; total: number }
  | { type: "progress"; loaded: number; total: number; percent: number | null }
  | { type: "success"; media: MediaViewModel }
  | { type: "error"; error: string; cause: unknown }
  | { type: "cancel" }
  | { type: "reset" };

export const INITIAL_UPLOAD_STATE: UploadState = Object.freeze({
  status: "idle",
  percent: null,
  loaded: 0,
  total: 0,
  media: null,
  error: null,
  cause: null,
}) as UploadState;

export function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case "start":
      return { ...INITIAL_UPLOAD_STATE, status: "uploading", percent: 0, total: action.total };
    case "progress":
      if (state.status !== "uploading") return state;
      return { ...state, loaded: action.loaded, total: action.total, percent: action.percent };
    case "success":
      return { ...state, status: "success", percent: 100, loaded: state.total, media: action.media };
    case "error":
      return { ...state, status: "error", error: action.error, cause: action.cause };
    case "cancel":
      return state.status === "uploading" ? { ...state, status: "canceled" } : state;
    case "reset":
      return INITIAL_UPLOAD_STATE;
  }
}

// ---- client-side file checks (mirror the server: external-communication/03 "Media upload") ----

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const;

/** `accept` attribute for a file input of the given purpose (avatars are images only). */
export function acceptFor(purpose: MediaPurposeDto): string {
  const types: readonly string[] =
    purpose === "avatar" ? IMAGE_MIME_TYPES : [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES];
  return types.join(",");
}

function formatMiB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * Pre-flight check of a picked file; `null` when it may be uploaded. The server re-checks by sniffing content,
 * so this only guards against obvious mistakes (wrong type, too large, empty).
 */
export function checkUploadFile(file: Pick<File, "type" | "size">, purpose: MediaPurposeDto): string | null {
  const isImage = (IMAGE_MIME_TYPES as readonly string[]).includes(file.type);
  const isVideo = (VIDEO_MIME_TYPES as readonly string[]).includes(file.type);
  if (purpose === "avatar" && !isImage) return "Choose a JPEG, PNG or WebP image.";
  if (!isImage && !isVideo) return "Choose a JPEG, PNG or WebP image, or an MP4 or WebM video.";
  if (file.size <= 0) return "That file is empty.";
  const max = isVideo ? LIMITS.videoBytesMax : LIMITS.imageBytesMax;
  if (file.size > max) return `${isVideo ? "Videos" : "Images"} must be ${formatMiB(max)} or smaller.`;
  return null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Human-readable message for upload failures (size/type rejections get specific wording). */
export function uploadErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: number }).status;
    if (status === 413) return "That file is too large.";
    if (status === 415) return "That file type isn't supported.";
  }
  return errorMessage(error);
}

export type UseUploadResult = {
  state: UploadState;
  /** Resolves with the uploaded media, or `null` when the upload failed or was canceled (see `state`). */
  start: (input: UploadMediaInput) => Promise<MediaViewModel | null>;
  cancel: () => void;
  reset: () => void;
};

export type UploadFn = typeof uploadMedia;

/** `upload` is injectable for tests; production code uses `uploadMedia` (XHR). */
export function useUpload(upload: UploadFn = uploadMedia): UseUploadResult {
  const [state, dispatch] = useReducer(uploadReducer, INITIAL_UPLOAD_STATE);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const start = useCallback(
    async (input: UploadMediaInput): Promise<MediaViewModel | null> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const isCurrent = () => mountedRef.current && controllerRef.current === controller;
      dispatch({ type: "start", total: input.file.size });
      try {
        const dto = await upload(input, {
          signal: controller.signal,
          onProgress: (p) => {
            if (isCurrent()) dispatch({ type: "progress", ...p });
          },
        });
        // A superseded or unmounted upload must not report a result the UI no longer tracks.
        if (!isCurrent()) return null;
        const media = toMediaVM(dto);
        controllerRef.current = null;
        dispatch({ type: "success", media });
        return media;
      } catch (error) {
        if (isCurrent()) {
          controllerRef.current = null;
          if (isAbortError(error)) dispatch({ type: "cancel" });
          else dispatch({ type: "error", error: uploadErrorMessage(error), cause: error });
        }
        return null;
      }
    },
    [upload],
  );

  const cancel = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controllerRef.current = null;
    controller.abort();
    dispatch({ type: "cancel" });
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    dispatch({ type: "reset" });
  }, []);

  return { state, start, cancel, reset };
}

export type { UploadMediaInput };
