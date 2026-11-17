# Consolidated Gaps, Issues & Open Questions

> Automatically compiled from `docs/questions-and-limitations/<wNN>-gaps.md` as waves land on `main`.
> Review open items after wave completion and run a fix pass to resolve them.

## Summary
- **Waves recorded:** 0
- **Open items:** 8 of 8 total (Gaps: 4, Issues: 1, Open Questions: 3) — all from Step 1 spec authoring

## Step 1 — Spec Authoring (2026-11-17)

| ID | Type | Spec / Area | Description | Proposed resolution | Status |
|---|---|---|---|---|---|
| `Q-01` | Question | `DEC-12`, backend | Private accounts, follow requests, blocking, muting, reporting, and direct messages are out of scope for v1. Are any of them required? | Keep out of v1; add as separate feature IDs if the owner requests. | Open |
| `Q-02` | Gap | `DEC-13`, media | No server-side image resizing/thumbnails or video transcoding; large originals are served to every client and video metadata is client-supplied. | v2: add an in-process worker using `sharp` + `ffmpeg` (still no third-party service) producing thumbnails and validated metadata. | Open |
| `Q-03` | Issue | `DEC-08`, frontend auth | Bearer token in `localStorage` is readable by injected scripts (XSS). Mitigated by strict CSP and no `dangerouslySetInnerHTML`. | Owner to confirm; alternative is HttpOnly cookie sessions + CSRF tokens. | Open |
| `Q-04` | Gap | `DEC-15`, internal-communication | SSE hub and SSE ticket store are in-memory → single API replica only. | If scaling is needed, fan out through Postgres `LISTEN/NOTIFY` and store tickets in a table. | Open |
| `Q-05` | Question | auth | No email verification or password reset (no email provider, `DEC-06`). Acceptable for v1? | Keep out of v1; optional admin CLI password reset script. | Open |
| `Q-06` | Gap | media lifecycle | Files of replaced avatars and soft-deleted posts stay on disk indefinitely. | Add a purge job for posts deleted > 30 days and for detached avatars. | Open |
| `Q-07` | Gap | persistence | Migrations run each file inside a transaction, which prevents `CREATE INDEX CONCURRENTLY`; acceptable for small data, not for large tables. | Support a `-- no-transaction` header in the runner when needed. | Open |
| `Q-08` | Question | product | Feed is strictly reverse-chronological; explore is "recent from everyone". Is any ranking/recommendation expected? | Keep chronological for v1. | Open |
