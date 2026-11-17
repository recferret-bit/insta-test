# Backend Specifications

- **Status:** Active

Business layer of `apps/api`: entities, invariants, use-case services, thin HTTP handlers, and ports.

| File | Content |
|---|---|
| [01-business-entities.md](./01-business-entities.md) | Business Entities, value objects, read models, invariants |
| [02-services-and-use-cases.md](./02-services-and-use-cases.md) | Service methods per module, transactions, emitted events |
| [03-ports-and-handlers.md](./03-ports-and-handlers.md) | Repository/adapter port interfaces, handler rules, jobs |

## Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| `F-BE-01` | Identity & sessions | Register/login/logout/me/update profile work per [02-services-and-use-cases.md](./02-services-and-use-cases.md#identityservice); passwords hashed with argon2id; tokens stored as SHA-256 only. |
| `F-BE-02` | Media handling | Upload sniffing, size/duration limits, owner/purpose checks, `uploaded → attached` transition enforced in `MediaAsset.attach()`. |
| `F-BE-03` | Posts | Create (1–10 media), edit caption with hashtag recompute, soft delete, counters maintained transactionally. |
| `F-BE-04` | Likes & comments | Idempotent like/unlike, comment create/delete with permission rule `INV-10`, counters & notifications in same tx. |
| `F-BE-05` | Follows | Idempotent follow/unfollow, self-follow rejected, both counters updated in one tx. |
| `F-BE-06` | Stories | 24h expiry via `Clock`, tray ordering, seen marks, author-only viewers. |
| `F-BE-07` | Feed, explore & search | Read-model queries with keyset pagination; search ranking per external spec. |
| `F-BE-08` | Notifications | Created in the triggering tx, deduped, deleted on undo, published after commit. |
| `F-BE-09` | Scheduled jobs | `StoryCleanupJob` and `MediaCleanupJob` run every 10 min under an advisory lock and delete expired data + files. |
| `F-BE-10` | Thin handlers | No handler exceeds validate → map → one service call → map → reply; lint rule forbids importing `data/` from `api/`. |
