# 01 — App Shell, Routing & Pages

Features: `F-FE-01` … `F-FE-10`.

## Stack

React 18, Vite 5, TypeScript strict, React Router 6 (data router), TanStack Query 5, plain CSS with custom properties (no CSS framework), `lucide-react` icons. No global state library besides a tiny session store (see [02-state-viewmodels-and-mappers.md](./02-state-viewmodels-and-mappers.md)).

## App Shell

- **Desktop (≥ 768 px):** left sidebar nav (Home, Search, Explore, Create, Notifications with badge, Profile), centered content column max 630 px (feed) / 935 px (profile, explore).
- **Mobile (< 768 px):** top bar (logo, notifications) + bottom tab bar (Home, Explore/Search, Create, Notifications, Profile).
- Global: toast region (`aria-live="polite"`), SSE connection manager mounted when authenticated, error boundary per route with "Retry".

## Route Table

| Path | Page component | Auth | Data (API) |
|---|---|---|---|
| `/login` | `LoginPage` | public-only | `POST /auth/login` |
| `/signup` | `SignupPage` | public-only | `POST /auth/signup` |
| `/` | `HomePage` | required | `GET /stories/tray`, `GET /feed` |
| `/explore` | `ExplorePage` | optional | `GET /explore` |
| `/search` | `SearchPage` | optional | `GET /search/users`, `GET /search/hashtags` |
| `/tags/:tag` | `HashtagPage` | optional | `GET /hashtags/{tag}/posts` |
| `/create` | `CreatePostPage` | required | `POST /media` (purpose post), `POST /posts` |
| `/create/story` | `CreateStoryPage` | required | `POST /media` (purpose story), `POST /stories` |
| `/p/:postId` | `PostPage` | optional | `GET /posts/{id}`, `GET /posts/{id}/comments`, like/comment mutations |
| `/u/:username` | `ProfilePage` | optional | `GET /users/{username}`, `GET /users/{username}/posts` |
| `/u/:username/followers` | `ProfilePage` + `FollowListModal` | optional | `GET /users/{username}/followers` |
| `/u/:username/following` | `ProfilePage` + `FollowListModal` | optional | `GET /users/{username}/following` |
| `/stories/:username` | `StoryViewerPage` (full-screen overlay) | optional | `GET /users/{username}/stories`, `POST /stories/{id}/seen`, `GET /stories/{id}/viewers` |
| `/notifications` | `NotificationsPage` | required | `GET /notifications`, `POST /notifications/read` |
| `/settings/profile` | `EditProfilePage` | required | `GET /me`, `POST /media` (purpose avatar), `PATCH /me` |
| `*` | `NotFoundPage` | — | — |

Route guards: `RequireAuth` redirects to `/login?next=<path>`; `PublicOnly` redirects logged-in users to `/`.

## Page Behaviour Notes

- **HomePage:** `StoryTray` (horizontal scroll; own avatar first with "+" to create a story) then `FeedList` (infinite query, `IntersectionObserver` sentinel, skeletons while loading).
- **PostCard:** header (avatar, username link, relative time, "…" menu for author), `MediaCarousel` (dots, arrow buttons, swipe; videos muted autoplay when ≥ 60 % visible, tap to unmute), action row (like heart with pop animation, comment icon → `/p/:id`), like count, caption with linkified `#tags` (→ `/tags/:tag`) and `@mentions` (→ `/u/:username`, display only), "View all N comments".
- **Double-tap / double-click** on media likes (never unlikes).
- **CreatePostPage:** step 1 pick files (`accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"`), client-side checks (size, ≤ 10 files, video duration via `<video>` metadata ≤ 60 s); step 2 reorder (drag + keyboard buttons) and caption; uploads run in parallel (max 3) with progress via `XMLHttpRequest.upload.onprogress`; publish disabled until all uploads succeed.
- **ProfilePage:** follow/unfollow button optimistic; "Edit profile" for self; grid tiles show video icon and multi-media icon overlays; hover shows like/comment counts.
- **StoryViewerPage:** segmented progress bar; left/right tap zones and `←/→` keys; `Esc` closes; auto-advance to next user in tray order; marks seen when a story starts displaying; author sees "Seen by N" opening viewer list; pause on hold/space.
- **NotificationsPage:** grouped "New" (unread) vs "Earlier"; calls `POST /notifications/read` with the newest id on open.
- **Errors:** `401` from any call → clear session, redirect to `/login`; `429` → toast "Slow down"; others → inline error with retry.
