/**
 * Post composer state (F-FE-04; frontend/01 "CreatePostPage"): pick 1–10 files, client checks (type, size, count,
 * video duration ≤ 60 s from `<video>` metadata), reorder, and parallel uploads (max 3) with per-file progress.
 *
 * Each item's upload state reuses the w01 `uploadReducer` (status `idle` = queued). The scheduler starts queued items
 * whenever a slot frees up. An aborted upload goes back to the queue, which keeps uploads alive across React
 * StrictMode's simulated unmount; a real unmount aborts everything.
 */
import { LIMITS } from "@insta/contracts";
import { useCallback, useEffect, useReducer, useRef } from "react";

import { uploadMedia } from "../api/media";
import { toMediaVM, type MediaViewModel } from "./mappers/media";
import {
  checkUploadFile,
  INITIAL_UPLOAD_STATE,
  uploadErrorMessage,
  uploadReducer,
  VIDEO_MIME_TYPES,
  type UploadAction,
  type UploadFn,
  type UploadState,
} from "./upload";

export const MAX_PARALLEL_UPLOADS = 3;
export const POST_MEDIA_MAX = LIMITS.postMediaMax;
export const VIDEO_PROBE_TIMEOUT_MS = 15_000;

export type VideoMetadata = { durationMs: number; width: number; height: number };
export type ProbeVideoFn = (file: File) => Promise<VideoMetadata>;

export type ComposerItem = {
  key: string;
  file: File;
  name: string;
  kind: "image" | "video";
  /** `blob:` URL for the local preview ("" when unavailable). */
  previewUrl: string;
  video: VideoMetadata | null;
  upload: UploadState;
};

export type ComposerState = {
  items: ComposerItem[];
  /** Problems from the most recent pick (rejected files), shown above the list. */
  problems: string[];
};

export type ComposerAction =
  | { type: "add"; items: ComposerItem[]; problems: string[] }
  | { type: "remove"; key: string }
  | { type: "move"; key: string; to: number }
  | { type: "upload"; key: string; action: UploadAction }
  | { type: "dismissProblems" }
  | { type: "clear" };

export const INITIAL_COMPOSER_STATE: ComposerState = Object.freeze({
  items: [],
  problems: [],
}) as ComposerState;

export function tooManyFilesMessage(): string {
  return `You can add up to ${POST_MEDIA_MAX} photos or videos.`;
}

export function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case "add": {
      const room = Math.max(0, POST_MEDIA_MAX - state.items.length);
      const accepted = action.items.slice(0, room);
      const problems = [...action.problems];
      if (accepted.length < action.items.length && !problems.includes(tooManyFilesMessage()))
        problems.push(tooManyFilesMessage());
      return { items: [...state.items, ...accepted], problems };
    }
    case "remove": {
      const items = state.items.filter((i) => i.key !== action.key);
      return items.length === state.items.length ? state : { ...state, items };
    }
    case "move": {
      const from = state.items.findIndex((i) => i.key === action.key);
      if (from < 0) return state;
      const to = Math.min(state.items.length - 1, Math.max(0, action.to));
      if (to === from) return state;
      const items = state.items.slice();
      const [moved] = items.splice(from, 1);
      if (moved) items.splice(to, 0, moved);
      return { ...state, items };
    }
    case "upload": {
      let changed = false;
      const items = state.items.map((item) => {
        if (item.key !== action.key) return item;
        const upload = uploadReducer(item.upload, action.action);
        if (upload === item.upload) return item;
        changed = true;
        return { ...item, upload };
      });
      return changed ? { ...state, items } : state;
    }
    case "dismissProblems":
      return state.problems.length ? { ...state, problems: [] } : state;
    case "clear":
      return INITIAL_COMPOSER_STATE;
  }
}

export type ComposerSummary = {
  total: number;
  uploaded: number;
  uploading: number;
  queued: number;
  failed: number;
  /** All items uploaded and at least one present: publish may be enabled. */
  ready: boolean;
  /** Uploaded media ids in display order. */
  mediaIds: string[];
};

export function summarizeComposer(items: readonly ComposerItem[]): ComposerSummary {
  const count = (status: UploadState["status"]) => items.filter((i) => i.upload.status === status).length;
  const uploaded = count("success");
  return {
    total: items.length,
    uploaded,
    uploading: count("uploading"),
    queued: count("idle"),
    failed: count("error") + count("canceled"),
    ready: items.length > 0 && uploaded === items.length,
    mediaIds: items.flatMap((i) => (i.upload.media ? [i.upload.media.id] : [])),
  };
}

/** Keys of queued items that may start now without exceeding `MAX_PARALLEL_UPLOADS`. */
export function nextUploads(items: readonly ComposerItem[], limit = MAX_PARALLEL_UPLOADS): string[] {
  const active = items.filter((i) => i.upload.status === "uploading").length;
  const slots = Math.max(0, limit - active);
  return items
    .filter((i) => i.upload.status === "idle")
    .slice(0, slots)
    .map((i) => i.key);
}

export function isVideoFile(file: Pick<File, "type">): boolean {
  return (VIDEO_MIME_TYPES as readonly string[]).includes(file.type);
}

/** Client checks beyond type/size: video duration 1 ms … 60 s. `null` when acceptable. */
export function checkVideoMetadata(meta: VideoMetadata): string | null {
  if (!Number.isFinite(meta.durationMs) || meta.durationMs <= 0)
    return "We couldn't read this video's length.";
  if (meta.durationMs > LIMITS.videoDurationMsMax)
    return `Videos must be ${LIMITS.videoDurationMsMax / 1000} seconds or shorter.`;
  return null;
}

/** Reads duration and size from `<video>` metadata (the API requires `duration_ms` for videos). */
export function readVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    if (typeof URL.createObjectURL !== "function") {
      reject(new Error("Video preview is not supported in this browser."));
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = () => {
      window.clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    const timer = window.setTimeout(() => {
      done();
      reject(new Error("Timed out reading video metadata."));
    }, VIDEO_PROBE_TIMEOUT_MS);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const meta = {
        durationMs: Number.isFinite(video.duration) ? Math.max(1, Math.round(video.duration * 1000)) : NaN,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      done();
      resolve(meta);
    };
    video.onerror = () => {
      done();
      reject(new Error("This video can't be read."));
    };
    video.src = url;
  });
}

function defaultPreviewUrl(file: File): string {
  return typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "";
}

function defaultRevokePreviewUrl(url: string): void {
  if (url && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
}

export type ComposerDeps = {
  upload?: UploadFn;
  probeVideo?: ProbeVideoFn;
  createPreviewUrl?: (file: File) => string;
  revokePreviewUrl?: (url: string) => void;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

let keySequence = 0;

export type PostComposer = {
  state: ComposerState;
  summary: ComposerSummary;
  /** Validates and queues picked files (rejections are listed in `state.problems`). */
  addFiles: (files: Iterable<File>) => Promise<void>;
  remove: (key: string) => void;
  move: (key: string, to: number) => void;
  retry: (key: string) => void;
  dismissProblems: () => void;
  /** Uploaded media in display order (only meaningful when `summary.ready`). */
  uploadedMedia: () => MediaViewModel[];
};

export function usePostComposer(deps: ComposerDeps = {}): PostComposer {
  const upload = deps.upload ?? uploadMedia;
  const probeVideo = deps.probeVideo ?? readVideoMetadata;
  const createPreviewUrl = deps.createPreviewUrl ?? defaultPreviewUrl;
  const revokePreviewUrl = deps.revokePreviewUrl ?? defaultRevokePreviewUrl;

  const [state, dispatch] = useReducer(composerReducer, INITIAL_COMPOSER_STATE);
  const controllers = useRef(new Map<string, AbortController>());
  const itemsRef = useRef(state.items);
  itemsRef.current = state.items;
  const mountedRef = useRef(true);
  const revokeRef = useRef(revokePreviewUrl);
  revokeRef.current = revokePreviewUrl;

  useEffect(() => {
    mountedRef.current = true;
    const active = controllers.current;
    return () => {
      mountedRef.current = false;
      // Aborted uploads re-queue themselves (see `start`), so a StrictMode remount resumes them.
      for (const controller of active.values()) controller.abort();
      // Revoke previews only on a real unmount (StrictMode remounts synchronously).
      window.setTimeout(() => {
        if (!mountedRef.current) for (const item of itemsRef.current) revokeRef.current(item.previewUrl);
      }, 0);
    };
  }, []);

  const start = useCallback(
    async (item: ComposerItem) => {
      const controller = new AbortController();
      controllers.current.set(item.key, controller);
      const isCurrent = () => controllers.current.get(item.key) === controller;
      const send = (action: UploadAction) => dispatch({ type: "upload", key: item.key, action });
      send({ type: "start", total: item.file.size });
      try {
        const dto = await upload(
          {
            file: item.file,
            fileName: item.name,
            purpose: "post",
            ...(item.video
              ? {
                  durationMs: item.video.durationMs,
                  width: item.video.width || undefined,
                  height: item.video.height || undefined,
                }
              : {}),
          },
          {
            signal: controller.signal,
            onProgress: (p) => {
              if (isCurrent()) send({ type: "progress", ...p });
            },
          },
        );
        if (!isCurrent()) return;
        controllers.current.delete(item.key);
        send({ type: "success", media: toMediaVM(dto) });
      } catch (error) {
        if (!isCurrent()) return;
        controllers.current.delete(item.key);
        // Aborted (unmount / StrictMode) → back to the queue; removed items ignore the dispatch.
        if (isAbortError(error)) send({ type: "reset" });
        else send({ type: "error", error: uploadErrorMessage(error), cause: error });
      }
    },
    [upload],
  );

  // Scheduler: fill free slots (max 3 in flight) with queued items, in display order.
  useEffect(() => {
    if (!mountedRef.current) return;
    const keys = nextUploads(state.items).filter((key) => !controllers.current.has(key));
    for (const key of keys) {
      const item = state.items.find((i) => i.key === key);
      if (item) void start(item);
    }
  }, [state.items, start]);

  const addFiles = useCallback(
    async (files: Iterable<File>) => {
      const picked = Array.from(files);
      if (picked.length === 0) return;
      const problems: string[] = [];
      const candidates: Array<{ file: File; video: VideoMetadata | null }> = [];
      for (const file of picked) {
        const problem = checkUploadFile(file, "post");
        if (problem) {
          problems.push(`${file.name}: ${problem}`);
          continue;
        }
        if (!isVideoFile(file)) {
          candidates.push({ file, video: null });
          continue;
        }
        try {
          const video = await probeVideo(file);
          const videoProblem = checkVideoMetadata(video);
          if (videoProblem) problems.push(`${file.name}: ${videoProblem}`);
          else candidates.push({ file, video });
        } catch {
          problems.push(`${file.name}: We couldn't read this video.`);
        }
      }
      const room = Math.max(0, POST_MEDIA_MAX - itemsRef.current.length);
      if (candidates.length > room) problems.push(tooManyFilesMessage());
      const items: ComposerItem[] = candidates.slice(0, room).map(({ file, video }) => ({
        key: `media-${++keySequence}`,
        file,
        name: file.name,
        kind: video ? "video" : "image",
        previewUrl: createPreviewUrl(file),
        video,
        upload: INITIAL_UPLOAD_STATE,
      }));
      dispatch({ type: "add", items, problems });
    },
    [probeVideo, createPreviewUrl],
  );

  const remove = useCallback(
    (key: string) => {
      const controller = controllers.current.get(key);
      controllers.current.delete(key);
      controller?.abort();
      const item = itemsRef.current.find((i) => i.key === key);
      if (item) revokePreviewUrl(item.previewUrl);
      dispatch({ type: "remove", key });
    },
    [revokePreviewUrl],
  );

  const move = useCallback((key: string, to: number) => dispatch({ type: "move", key, to }), []);

  /** Failed or canceled → queued again (the scheduler picks it up). */
  const retry = useCallback((key: string) => {
    const item = itemsRef.current.find((i) => i.key === key);
    if (item && (item.upload.status === "error" || item.upload.status === "canceled"))
      dispatch({ type: "upload", key, action: { type: "reset" } });
  }, []);

  const dismissProblems = useCallback(() => dispatch({ type: "dismissProblems" }), []);

  const uploadedMedia = useCallback(
    () => itemsRef.current.flatMap((i) => (i.upload.media ? [i.upload.media] : [])),
    [],
  );

  return {
    state,
    summary: summarizeComposer(state.items),
    addFiles,
    remove,
    move,
    retry,
    dismissProblems,
    uploadedMedia,
  };
}
