# 01 — Shared Contracts Package (`@insta/contracts`)

Feature: `F-ICOMM-01`.

## Purpose

Single source of truth for wire shapes shared by `apps/api` (validation + serialization) and `apps/web` (typed client + event parsing). It contains **only** wire-level DTOs — never Business Entities or Row types.

## Layout

```text
packages/contracts/
├── package.json        # name "@insta/contracts", "type": "module", exports "./dist/index.js" + types
├── tsconfig.json
└── src/
    ├── index.ts        # re-exports everything
    ├── ids.ts          # ID_PREFIX = { user: "usr", session: "ses", media: "med", post: "pst", comment: "cmt", story: "sty", notification: "ntf" }; publicId(prefix) Zod factory
    ├── errors.ts       # ErrorCode enum (z.enum), ErrorResponseDto schema
    ├── pagination.ts   # PageQuery schema (cursor, limit), page(itemSchema) factory
    ├── limits.ts       # LIMITS constants (usernameMax 30, captionMax 2200, commentMax 500, bioMax 150, …)
    ├── dto/
    │   ├── common.ts   # UserSummaryDto, MediaResponseDto
    │   ├── auth.ts     # SignupRequestDto, LoginRequestDto, AuthTokenResponseDto, SseTicketResponseDto
    │   ├── users.ts    # MeResponseDto, UserProfileResponseDto, UpdateProfileRequestDto, FollowStateResponseDto, FollowListItemDto
    │   ├── media.ts    # UploadMediaFields (non-file multipart fields)
    │   ├── posts.ts    # CreatePostRequestDto, UpdatePostRequestDto, PostResponseDto, LikeStateResponseDto
    │   ├── comments.ts # CreateCommentRequestDto, CommentResponseDto
    │   ├── stories.ts  # CreateStoryRequestDto, StoryResponseDto, StoryTrayResponseDto, UserStoriesResponseDto, StoryViewerResponseDto
    │   ├── search.ts   # UserSearchResponseDto, HashtagSearchResponseDto, HashtagPostsResponseDto
    │   └── notifications.ts # NotificationResponseDto, MarkNotificationsReadRequestDto, UnreadCountResponseDto
    └── events.ts       # ServerEvent discriminated union (see 02-domain-events-and-sse.md)
```

## Rules

- Each DTO is declared as `export const XDto = z.object({...}).strict()` (requests) or `.passthrough()`-free object (responses) with `export type XDto = z.infer<typeof XDto>`.
- Request schemas are `.strict()` (unknown keys → `VALIDATION_FAILED`). Response schemas are non-strict so clients tolerate additive fields.
- Field limits in schemas MUST equal the DB `CHECK` limits in [persistence/01-schema.md](../persistence/01-schema.md) and the domain limits in [backend/01-business-entities.md](../backend/01-business-entities.md). A unit test in `apps/api` asserts the shared constants (`LIMITS.captionMax = 2200`, …) exported from `contracts/src/limits.ts` match the domain constants.
- Versioning: the package is internal (`"private": true`), versioned with the repo. Breaking wire changes require `/api/v2` (see [external-communication/01-api-conventions.md](../external-communication/01-api-conventions.md)).
- Build: `tsc -b` emits `dist/`; `apps/*` depend on `"@insta/contracts": "*"` via workspaces and reference it in `tsconfig` project references.

## In-Process Service Calls

- Handlers call services directly (`await postService.createPost(cmd)`); services call repositories through ports. No HTTP between internal components.
- Services do not call other services inside a transaction; cross-module side effects in the same tx are done via the other module's repository port (e.g. `LikeService` → `NotificationRepository`). Cross-module reactions outside the tx use domain events.
