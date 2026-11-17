# Frontend Specifications

- **Status:** Active

Minimal, modern, responsive React SPA (`apps/web`) covering every user workflow, talking to the API only through a typed client (`DEC-02`).

| File | Content |
|---|---|
| [01-app-shell-and-routing.md](./01-app-shell-and-routing.md) | App shell, route table, page specs and their API calls |
| [02-state-viewmodels-and-mappers.md](./02-state-viewmodels-and-mappers.md) | Typed API client, session store, TanStack Query keys, ViewModels, `DTO → ViewModel` mappers, SSE client |
| [03-design-system.md](./03-design-system.md) | Design tokens, components, responsive layout, accessibility |

## Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| `F-FE-01` | App shell & routing | All routes in [01-app-shell-and-routing.md](./01-app-shell-and-routing.md) render; unauthenticated users hitting protected routes are redirected to `/login?next=…`. |
| `F-FE-02` | Auth pages | Sign up & log in forms with inline validation errors mapped from `VALIDATION_FAILED.details`; token persisted; logout clears caches. |
| `F-FE-03` | Home feed | Infinite scroll of `PostCard`s using `next_cursor`; story tray on top; empty state suggests Explore. |
| `F-FE-04` | Post composer | Select 1–10 images/videos, preview & reorder, caption with live counter (2200), uploads with progress, publish → navigates to post. |
| `F-FE-05` | Post detail | Media carousel (swipe/arrow keys), like toggle (optimistic), comments list + composer, edit caption/delete for author. |
| `F-FE-06` | Profile | Header (avatar with story ring, counters, bio, follow button / edit profile), 3-column post grid, followers/following modal lists. |
| `F-FE-07` | Edit profile | Change avatar (upload purpose `avatar`), username, full name, bio. |
| `F-FE-08` | Explore & search | Explore grid; search box with debounced (250 ms) user + hashtag results; hashtag page grid. |
| `F-FE-09` | Stories | Tray, full-screen viewer with progress bars (images 5 s, videos their duration), tap/keyboard navigation, mark seen, author viewer list, create story. |
| `F-FE-10` | Notifications | Activity page, live badge via SSE, toast on new notification, mark read on page open. |
| `F-FE-11` | Theming & a11y | Light/dark via `prefers-color-scheme` + manual toggle; WCAG 2.1 AA contrast; full keyboard operation; Lighthouse a11y ≥ 90. |
| `F-FE-12` | Runtime config | `window.__APP_CONFIG__.apiUrl` from `/config.js` (generated from `PUBLIC_API_URL` at container start); no rebuild per environment. |
