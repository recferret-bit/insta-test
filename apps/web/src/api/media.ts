/**
 * Media upload — external-communication/03-media-and-posts-api.md#media-upload--uploadmediarequest-multipart-parts.
 * Uses `XMLHttpRequest` (not fetch) so upload progress is observable (`xhr.upload.onprogress`, F-FE-04).
 */
import { MediaResponseDto, type MediaPurposeDto } from "@insta/contracts";

import { type ApiError, authHeaders, buildUrl, decode, notifyIfUnauthenticated, toApiError } from "./http";

export type UploadMediaInput = {
  file: Blob;
  /** Optional filename sent with the `file` part (the server sniffs the type; the name is informational). */
  fileName?: string;
  purpose: MediaPurposeDto;
  /** Videos only (1–8192), read client-side from `<video>` metadata. */
  width?: number;
  height?: number;
  /** Required for videos (1–60000 ms). */
  durationMs?: number;
};

export type UploadProgress = {
  loaded: number;
  total: number;
  /** 0–100, rounded down; `null` when the total is unknown. */
  percent: number | null;
};

export type UploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
};

/** Builds the multipart body; text parts first, `file` last (exactly one file part). */
export function buildUploadForm(input: UploadMediaInput): FormData {
  const form = new FormData();
  form.append("purpose", input.purpose);
  if (input.width !== undefined) form.append("width", String(Math.round(input.width)));
  if (input.height !== undefined) form.append("height", String(Math.round(input.height)));
  if (input.durationMs !== undefined) form.append("duration_ms", String(Math.round(input.durationMs)));
  if (input.fileName !== undefined) form.append("file", input.file, input.fileName);
  else form.append("file", input.file);
  return form;
}

function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * `POST /media` (`multipart/form-data`) → `201 MediaResponseDto`.
 * Rejects with `ApiError` for non-2xx, `DOMException("AbortError")` when aborted, `TypeError` on network failure.
 */
export function uploadMedia(input: UploadMediaInput, opts: UploadOptions = {}): Promise<MediaResponseDto> {
  return new Promise<MediaResponseDto>((resolve, reject) => {
    const { signal, onProgress } = opts;
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildUrl("/media"));
    const headers = authHeaders();
    const hadToken = "Authorization" in headers;
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.setRequestHeader("Accept", "application/json");

    const onAbortSignal = () => xhr.abort();
    signal?.addEventListener("abort", onAbortSignal, { once: true });
    const cleanup = () => signal?.removeEventListener("abort", onAbortSignal);

    if (onProgress) {
      xhr.upload.onprogress = (event: ProgressEvent) => {
        const total = event.lengthComputable ? event.total : 0;
        onProgress({
          loaded: event.loaded,
          total,
          percent: total > 0 ? Math.min(100, Math.floor((event.loaded / total) * 100)) : null,
        });
      };
    }

    xhr.onload = () => {
      cleanup();
      const body = parseBody(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(decode(body, MediaResponseDto));
        } catch (error) {
          reject(error);
        }
        return;
      }
      const error: ApiError = toApiError(xhr.status, body, xhr.getResponseHeader("X-Request-Id"));
      notifyIfUnauthenticated(error, hadToken);
      reject(error);
    };
    xhr.onerror = () => {
      cleanup();
      reject(new TypeError("Network error while uploading media"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Upload aborted", "AbortError"));
    };

    xhr.send(buildUploadForm(input));
  });
}
