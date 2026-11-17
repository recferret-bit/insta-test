// Field limits shared with the API (must equal DB CHECKs and domain limits).
// Sources: external-communication/02..06, frontend/01 (CreatePostPage client checks).

export const LIMITS = {
  usernameMin: 3,
  usernameMax: 30,
  emailMax: 254,
  passwordMin: 8,
  passwordMax: 128,
  loginMax: 254,
  fullNameMax: 60,
  bioMax: 150,
  captionMax: 2200,
  commentMax: 500,
  postMediaMin: 1,
  postMediaMax: 10,
  imageMaxBytes: 10 * 1024 * 1024,
  videoMaxBytes: 50 * 1024 * 1024,
  videoMaxDurationMs: 60_000,
  mediaDimensionMax: 8192,
  userSearchQueryMax: 50,
  hashtagSearchQueryMax: 64,
} as const;

export const ACCEPTED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
] as const;

export type AcceptedUploadMimeType = (typeof ACCEPTED_UPLOAD_MIME_TYPES)[number];

/** Value for `<input type="file" accept=…>` on CreatePostPage. */
export const UPLOAD_ACCEPT_ATTR = ACCEPTED_UPLOAD_MIME_TYPES.join(",");
