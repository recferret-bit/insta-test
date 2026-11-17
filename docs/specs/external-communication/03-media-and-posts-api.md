# 03 — Media & Posts API

Features: `F-ECOMM-04` (media), `F-ECOMM-05` (posts). Entities: `ENT-Media`, `ENT-Post`.

## Endpoints

| Method & Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/v1/media` | required | `multipart/form-data` (`UploadMediaRequest`) | `201 MediaResponseDto` | 400, 401, 413, 415, 429 |
| `GET /media/{storage_key}` | none | — | `200` file bytes | 404 |
| `POST /api/v1/posts` | required | `CreatePostRequestDto` | `201 PostResponseDto` | 400, 401, 422 `MEDIA_INVALID` |
| `GET /api/v1/posts/{post_id}` | optional | — | `200 PostResponseDto` | 400, 404 |
| `PATCH /api/v1/posts/{post_id}` | required | `UpdatePostRequestDto` | `200 PostResponseDto` | 400, 401, 403, 404 |
| `DELETE /api/v1/posts/{post_id}` | required | — | `204` | 401, 403, 404 |
| `GET /api/v1/users/{username}/posts` | optional | `?cursor&limit` | `200 PostPageResponseDto` | 400, 404 |

## Media Upload — `UploadMediaRequest` (multipart parts)

| Part | Type | Rule |
|---|---|---|
| `file` | binary | Required, exactly one; image ≤ 10 MiB, video ≤ 50 MiB |
| `purpose` | text | `post` \| `story` \| `avatar` |
| `width` | text (int) | Optional, videos only, 1–8192 |
| `height` | text (int) | Optional, videos only, 1–8192 |
| `duration_ms` | text (int) | Required for videos, 1–60000 |

- Type is sniffed from magic bytes (`file-type` library); the client `Content-Type` is ignored.
- Image width/height are read server-side from the header (`image-size` library).
- File is streamed to `${MEDIA_DIR}/<yyyy>/<mm>/<uuid>.<ext>`; DB row inserted after the write succeeds; on DB failure the file is removed.
- `avatar` purpose requires `kind = image`.

## Media Serving

- `GET /media/<yyyy>/<mm>/<uuid>.<ext>` served by `@fastify/static` from `MEDIA_DIR`.
- Headers: correct `Content-Type`, `Cache-Control: public, max-age=31536000, immutable`, `Accept-Ranges: bytes` (video seeking), `X-Content-Type-Options: nosniff`.
- Path traversal impossible: only keys matching `^\d{4}/\d{2}/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm)$` are served.

## Post DTOs

```ts
type CreatePostRequestDto = {
  caption?: string;      // 0–2200, default ""
  media_ids: string[];   // 1–10 unique med_… IDs, order = display order
};

type UpdatePostRequestDto = {
  caption: string;       // 0–2200 (media are immutable after publish)
};

type PostResponseDto = {
  id: string;                    // pst_…
  author: UserSummaryDto;
  caption: string;
  media: MediaResponseDto[];     // ordered by position
  hashtags: string[];            // lowercased, without '#', in first-appearance order
  like_count: number;
  comment_count: number;
  viewer_has_liked: boolean;
  created_at: string;
  updated_at: string;
};

type PostPageResponseDto = Page<PostResponseDto>;   // ordered created_at DESC, id DESC
```

## Behaviour

- Create: validates every media (owner = caller, purpose `post`, status `uploaded`), inserts `posts`, `post_media`, `post_hashtags`, marks media `attached`, increments `users.posts_count` — one transaction.
- Edit caption: recomputes hashtags (delete + insert in `post_hashtags`), bumps `updated_at`.
- Delete: sets `deleted_at`, decrements `users.posts_count`; media files stay until the post row is purged (`Q-06`).
- Non-author `PATCH`/`DELETE` → `403 FORBIDDEN`.

## Mapping (DTO ↔ Business)

| DTO | Business | Mapper |
|---|---|---|
| multipart parts | `UploadMediaCommand { ownerId, purpose, stream, declaredWidth?, declaredHeight?, durationMs? }` | `mapUploadMultipartToCommand` |
| `MediaAsset` | `MediaResponseDto` (`url` built from `PUBLIC_API_URL`) | `mapMediaToResponseDto` |
| `CreatePostRequestDto` | `CreatePostCommand { authorId, caption, mediaIds: MediaId[] }` | `mapCreatePostDtoToCommand` |
| `UpdatePostRequestDto` | `UpdatePostCaptionCommand { postId, actorId, caption }` | `mapUpdatePostDtoToCommand` |
| `PostView` | `PostResponseDto` | `mapPostViewToResponseDto` |
