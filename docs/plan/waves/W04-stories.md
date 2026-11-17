# W04 — 24-Hour Stories

| Field | Value |
|---|---|
| Wave | `w04` (`stories`) |
| Depends on | `w01` |
| Runs concurrently with | `w02`, `w03`, and possibly `w06` (disjoint `owned_paths`) |
| Branch | `wave/w04-stories` from `main` (after w01 lands) |
| Compose | `yd-insta-w04`, slot 4, ports 21080–21099 (web 21080, api 21081) |
| Migrations | none |
| Spec refs | `F-BE-06`, `F-BE-09` (story cleanup), `F-ECOMM-08`, `F-FE-09`, `F-CORE-03`, `F-DB-04` |

## Goal

Photo/video stories visible for 24 hours: create and delete, a story tray of followees ∪ self with unseen first,
per-user active stories, "seen" marks, an author-only viewer list, and `StoryCleanupJob`. Web: `StoryTray`,
full-screen `StoryViewerPage`, `CreateStoryPage`.

## Specs to Read First

ENT-Story, ENT-StoryView in `specs/03`; `INV-06`, `INV-10`; `backend/01`, `backend/02` (StoryService), `backend/03`
(StoryRepository, jobs); `external-communication/05`; `frontend/01` (`/stories/:username`, `/create/story`, StoryViewerPage notes).

## Endpoints in Scope (`stories.routes.ts`)

`POST /stories`, `DELETE /stories/{id}`, `GET /stories/tray`, `GET /users/{username}/stories`,
`POST /stories/{id}/seen`, `GET /stories/{id}/viewers` (all under `/api/v1`).

## Task DAG

```text
W04-01 (contracts) ──┬── W04-02 Stories API & StoryCleanupJob
                     └── W04-03 Web tray, viewer & create story
                                └──► W04-04 validate
```

### W04-01 — Freeze story entities & mappers (`contracts`)

- Confirm `dto/stories.ts`. `Story.create` (`expiresAt = createdAt + 24h` from `Clock`), `isActive(now)`; `StorySeen`;
  `StoryItemView`, `StoryTrayItem`, `StoryViewerView` in `stories/views.ts`.
- `StoryRow` / `StoryViewRow` mappers + round-trip tests; web `toStoryVM` (image 5000 ms, video `duration_ms`, `remainingLabel`).

### W04-02 — Stories API & `StoryCleanupJob` (`worker`)

- `StoryService` per backend/02: create (attach `story`-purpose media), delete (author only; delete story + media row in
  one tx, remove file after commit, failure logged), tray (followees ∪ self with ≥ 1 active story; self first, then unseen
  first, then most recent), user stories ascending, `markSeen` (skip author, insert-if-absent), `listViewers` (author only).
- `view_count` only for the author, `null` for others; expired stories → `404` everywhere (`INV-06`).
- `story-cleanup.job.ts`: advisory lock, delete `expires_at < now()` in batches of 500 with their media rows and files.

### W04-03 — Web tray, viewer & create story (`worker`)

- `StoryTray`: horizontal scroll, own avatar first with "+" → `/create/story`, gradient ring for unseen, muted ring for seen.
  Exported for `HomePage` (w05).
- `StoryViewerPage`: full-screen overlay, `StoryProgress` segmented bars (images 5 s, videos their duration), left/right
  tap zones, `←/→`, `Esc` closes, hold/space pauses, auto-advance to next tray user, marks seen when a story starts;
  author sees "Seen by N" opening `StoryViewers` sheet.
- `CreateStoryPage`: pick one image/video, upload purpose `story` (w01 upload hook), preview, share.
- Hooks `state/stories*` (tray + user stories queries, seen mutation updating tray cache).

### W04-04 — Validate (`validate`)

2-iteration `wave-validate`; compose preview on slot 4 (create story, view from a second account, check viewer list).

## Acceptance Criteria

- Each endpoint: happy path, `401`, `400` integration tests with contract-parsed responses.
- With a fake clock at +24h + 1 ms a story disappears from tray, user stories and `seen`/`viewers` (`404`).
- Non-author delete or viewer list → `403`; author viewing own story records no view; repeated seen → one row.
- Tray ordering and `viewer_has_seen` correct for a mixed seen/unseen dataset.
- Cleanup job removes expired stories, their media rows and files; a second concurrent run is skipped by the advisory lock.
- Web: progress timing, keyboard navigation and pause covered by tests with fake timers.

## Out of Scope

Placing the tray on `HomePage` (w05). Story replies/reactions (not in spec).
