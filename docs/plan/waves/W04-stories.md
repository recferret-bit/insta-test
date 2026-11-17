# W04 — Stories (24h), tray, viewer, seen marks & cleanup job

- **Wave:** `w04` · branch `wave/w04-stories` from `main` after `w01` lands · depends on: `w01` · runs concurrently with `w02`, `w03`, `w05`
- **Preview:** slot 4 → web `21080`, api `21081` (`yd-insta-w04`)
- **Exact `owned_paths`:** see `w04` in [WAVE_MANIFEST.json](../WAVE_MANIFEST.json)
- **Specs:** `ENT-Story`, `ENT-StoryView`; [external-communication/05](../../specs/external-communication/05-stories-api.md); StoryService and StoryCleanupJob in backend/02–03; `/stories/:username`, `/create/story` in frontend/01; `INV-06`

## Goal

Add 24-hour photo/video stories: create/delete, a tray of followees + self with unseen first, active stories per user, seen marks, a viewer list only the author can see, hard deletion of expired stories with their files, and the story tray, full-screen viewer and story composer in the web app.

## Tasks

| Task | Kind | Scope | Spec refs |
|---|---|---|---|
| W04-01 | contracts | Re-check `dto/stories.ts`, `StoryRepository` port, `story.row.ts`. Implement `story.row-mapper.ts`. Raw-SQL `story-fixtures.ts`, which also inserts `follows` rows directly so the tray can be tested without w03. | F-ECOMM-08, F-DB-04 |
| W04-02 | worker | `Story`/`StorySeen` entities, `StoryService`, `story.pg-repository.ts`, `stories.routes.ts`, `story.dto-mapper.ts`, `jobs/story-cleanup.job.ts`. | F-BE-06, F-BE-09, F-ECOMM-08 |
| W04-03 | worker | `components/stories` (StoryTray keeps the frozen stub props; StoryRing, StoryProgress, StoryViewersSheet), `StoryViewerPage`, `CreateStoryPage`, `state/stories.ts`, `state/mappers/stories.ts`. | F-FE-09 |
| W04-04 | validate | wave-validate ×2; `w04-check.md`, `w04-gaps.md`, review packet. | — |

## Acceptance criteria

- `expires_at = created_at + 24h` from the `Clock`. Expired stories are invisible to every read (`404`).
- Media must be owned, purpose `story`, status `uploaded`. Otherwise `422 MEDIA_INVALID`.
- Delete is author-only. The story and media rows are removed in one tx, and the file is removed after commit (a failure there is only logged).
- The tray lists followees + self with ≥ 1 active story, unseen first. `viewer_has_seen` is correct. `view_count` appears only for the author.
- Mark-seen is skipped for the author, and the first view wins. The viewer list is author-only (`403`).
- `StoryCleanupJob` holds an advisory lock, works in batches of 500, deletes files, and logs `{ job, deleted, durationMs }`.
- Web viewer: images 5 s, videos their own duration; tap zones and ←/→; Esc closes; hold/space pauses; auto-advances to the next tray user; respects `prefers-reduced-motion`.

## Tests required

Unit: `Story.create` with a fake clock, service rules, mapper round-trips, `toStoryVM` durations. Integration: every endpoint (happy, `401`, `400`/`403`/`404`), expiry with a shifted clock, cleanup job removes rows and files.

## Cross-wave notes

- Runs at the same time as w02/w03/w05. Touch nothing outside the `w04` `owned_paths`. `HomePage` (w02) and `ProfilePage` (w01) already render `StoryTray` and the avatar ring through the w00 stub props.
