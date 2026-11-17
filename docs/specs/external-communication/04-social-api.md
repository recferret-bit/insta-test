# 04 — Social API (Likes, Comments, Follows)

Features: `F-ECOMM-06` (likes & comments), `F-ECOMM-07` (follows). Entities: `ENT-Like`, `ENT-Comment`, `ENT-Follow`.

## Likes

| Method & Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `PUT /api/v1/posts/{post_id}/like` | required | — | `200 LikeStateResponseDto` | 400, 401, 404 |
| `DELETE /api/v1/posts/{post_id}/like` | required | — | `200 LikeStateResponseDto` | 400, 401, 404 |
| `GET /api/v1/posts/{post_id}/likes` | optional | `?cursor&limit` | `200 UserSummaryPageResponseDto` | 400, 404 |

```ts
type LikeStateResponseDto = {
  post_id: string;      // pst_…
  liked: boolean;
  like_count: number;
};
```

- `PUT` when already liked → `200` with unchanged state, no event, no notification (idempotent).
- `DELETE` when not liked → `200 { liked: false }`.
- Like by non-author creates a `like` notification; unlike deletes it.

## Comments

| Method & Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `GET /api/v1/posts/{post_id}/comments` | optional | `?cursor&limit` | `200 CommentPageResponseDto` | 400, 404 |
| `POST /api/v1/posts/{post_id}/comments` | required | `CreateCommentRequestDto` | `201 CommentResponseDto` | 400, 401, 404 |
| `DELETE /api/v1/comments/{comment_id}` | required | — | `204` | 401, 403, 404 |

```ts
type CreateCommentRequestDto = {
  text: string;          // 1–500 after trim
};

type CommentResponseDto = {
  id: string;            // cmt_…
  post_id: string;       // pst_…
  author: UserSummaryDto;
  text: string;
  created_at: string;
};

type CommentPageResponseDto = Page<CommentResponseDto>;  // ordered created_at ASC, id ASC
```

- Create increments `posts.comment_count`; delete (soft) decrements it.
- Delete allowed for comment author or post author; others → `403`.
- Comment by non-author creates a `comment` notification (not removed on comment deletion; FK cascade only on hard delete — notification list hides notifications whose comment is soft-deleted).

## Follows

| Method & Path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `PUT /api/v1/users/{username}/follow` | required | — | `200 FollowStateResponseDto` | 401, 404, 422 `CANNOT_FOLLOW_SELF` |
| `DELETE /api/v1/users/{username}/follow` | required | — | `200 FollowStateResponseDto` | 401, 404 |
| `GET /api/v1/users/{username}/followers` | optional | `?cursor&limit` | `200 UserSummaryPageResponseDto` | 400, 404 |
| `GET /api/v1/users/{username}/following` | optional | `?cursor&limit` | `200 UserSummaryPageResponseDto` | 400, 404 |

```ts
type FollowStateResponseDto = {
  user_id: string;          // usr_… of followee
  following: boolean;
  followers_count: number;  // followee's updated count
};

type FollowListItemDto = UserSummaryDto & {
  followed_at: string | null;   // when the relation was created
};

type UserSummaryPageResponseDto = Page<FollowListItemDto>;  // ordered created_at DESC
```

- Follow/unfollow update both `follower.following_count` and `followee.followers_count` in one transaction.
- Follow creates a `follow` notification; unfollow deletes it.
- For `GET /posts/{id}/likes`, `followed_at` carries the like's `created_at` (field reused as "relation time").

## Mapping (DTO ↔ Business)

| DTO | Business | Mapper |
|---|---|---|
| path `post_id` | `LikeCommand { postId, userId }` | inline `parsePublicId` in route |
| `LikeState { postId, liked, likeCount }` | `LikeStateResponseDto` | `mapLikeStateToResponseDto` |
| `CreateCommentRequestDto` | `CreateCommentCommand { postId, authorId, text }` | `mapCreateCommentDtoToCommand` |
| `CommentView` | `CommentResponseDto` | `mapCommentViewToResponseDto` |
| path `username` | `FollowCommand { followerId, followeeUsername }` | inline in route |
| `FollowState { followeeId, following, followersCount }` | `FollowStateResponseDto` | `mapFollowStateToResponseDto` |
| `UserSummaryView` (+ relation time) | `FollowListItemDto` | `mapUserSummaryViewToFollowListItemDto` |
