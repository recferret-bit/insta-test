# 05 — Stories API

Feature: `F-ECOMM-08`. Entities: `ENT-Story`, `ENT-StoryView`.

## Endpoints

| Method & Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/v1/stories` | required | `CreateStoryRequestDto` | `201 StoryResponseDto` | 400, 401, 422 `MEDIA_INVALID` |
| `DELETE /api/v1/stories/{story_id}` | required | — | `204` | 401, 403, 404 |
| `GET /api/v1/stories/tray` | required | — | `200 StoryTrayResponseDto` | 401 |
| `GET /api/v1/users/{username}/stories` | optional | — | `200 UserStoriesResponseDto` | 404 |
| `POST /api/v1/stories/{story_id}/seen` | required | — | `204` | 401, 404 |
| `GET /api/v1/stories/{story_id}/viewers` | required | `?cursor&limit` | `200 StoryViewerPageResponseDto` | 401, 403, 404 |

## DTO Schemas

```ts
type CreateStoryRequestDto = {
  media_id: string;           // med_…, purpose story, status uploaded, owned by caller
};

type StoryResponseDto = {
  id: string;                 // sty_…
  author: UserSummaryDto;
  media: MediaResponseDto;
  created_at: string;
  expires_at: string;         // created_at + 24h
  viewer_has_seen: boolean;   // false when anonymous
  view_count: number | null;  // only for the author, else null
};

type StoryTrayItemDto = {
  user: UserSummaryDto;
  has_unseen: boolean;
  latest_story_at: string;
  story_count: number;
};

type StoryTrayResponseDto = {
  items: StoryTrayItemDto[];  // self first (if any active), then has_unseen DESC, latest_story_at DESC; max 100
};

type UserStoriesResponseDto = {
  user: UserSummaryDto;
  stories: StoryResponseDto[];  // active only, created_at ASC
};

type StoryViewerResponseDto = {
  user: UserSummaryDto;
  viewed_at: string;
};

type StoryViewerPageResponseDto = Page<StoryViewerResponseDto>;  // viewed_at DESC
```

## Behaviour

- Tray includes users the viewer follows plus self with ≥ 1 active story.
- `POST …/seen` is idempotent (`ON CONFLICT DO NOTHING`); author viewing own story is a no-op `204`.
- Expired or deleted story on any endpoint → `404`.
- Viewer list only for the story author → otherwise `403`.

## Mapping (DTO ↔ Business)

| DTO | Business | Mapper |
|---|---|---|
| `CreateStoryRequestDto` | `CreateStoryCommand { authorId, mediaId }` | `mapCreateStoryDtoToCommand` |
| `StoryItemView` | `StoryResponseDto` | `mapStoryItemViewToResponseDto` |
| `StoryTrayItem` | `StoryTrayItemDto` | `mapStoryTrayItemToDto` |
| `StoryViewerView { user, viewedAt }` | `StoryViewerResponseDto` | `mapStoryViewerToResponseDto` |
