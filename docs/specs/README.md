# Project Specifications Index — Instagram-like Photo & Video Sharing App

> **Spec-First Rule:** Agents MUST read the relevant category specs below before writing or modifying code.
> If code and spec diverge, update the spec first (same change) or record a question in
> [`docs/questions-and-limitations/`](../questions-and-limitations/README.md).

## Product Summary

A self-hosted, full-stack analogue of a photo/video social network with a modern, minimal web UI:

- Account sign-up / login (bearer session tokens).
- Publishing posts with 1–10 photos and/or short videos plus a caption with `#hashtags`.
- Home feed of followed accounts, explore grid of recent posts.
- User profiles (avatar, bio, counters, post grid), editing own profile.
- Follow / unfollow, followers / following lists.
- Likes and flat comments on posts.
- Search by username / full name and by hashtag.
- 24-hour stories with a story tray, viewer, and "seen" tracking.
- Live in-app notifications (likes, comments, follows) over Server-Sent Events.

## Category Index

| Category | Directory | Status | Summary |
|---|---|---|---|
| Core Specs | [specs/](./specs/README.md) | Active | Targeted structure, architecture, cross-layer entity map, decisions |
| Frontend | [frontend/](./frontend/README.md) | Active | Routes, pages, components, ViewModels, design tokens, typed API client |
| Backend | [backend/](./backend/README.md) | Active | Business entities, domain services (use cases), thin handlers, ports |
| Persistence | [persistence/](./persistence/README.md) | Active | PostgreSQL schema, indexes, forward-only migrations, row mappers |
| Internal Communication | [internal-communication/](./internal-communication/README.md) | Active | Shared `contracts` package, in-process domain events, SSE stream protocol |
| External Communication | [external-communication/](./external-communication/README.md) | Active | Public REST `/api/v1/*`, Req/Res DTOs, error codes, auth; no third-party integrations |
| Infra | [infra/](./infra/README.md) | Active | Dockerfiles, Compose stack (`web`/`api`/`db`), wave port blocks, env vars, CI, probes |

## Feature ID Prefixes

| Prefix | Category |
|---|---|
| `F-CORE-NN` | Core specs (structure, architecture, cross-cutting rules) |
| `F-FE-NN` | Frontend |
| `F-BE-NN` | Backend |
| `F-DB-NN` | Persistence |
| `F-ICOMM-NN` | Internal communication |
| `F-ECOMM-NN` | External communication |
| `F-INFRA-NN` | Infra |

## Entity Catalog

All cross-layer entities (`ENT-*`) are defined in
[specs/03-domain-and-entity-map.md](./specs/03-domain-and-entity-map.md):
`ENT-User`, `ENT-Session`, `ENT-Media`, `ENT-Post`, `ENT-Comment`, `ENT-Like`, `ENT-Follow`,
`ENT-Story`, `ENT-StoryView`, `ENT-Notification`.

## Delivery Plan

Waves `w00`–`w07`, their task `owned_paths` and dependency DAG are in
[docs/plan/PRODUCT_WAVES.md](../plan/PRODUCT_WAVES.md) (machine-readable:
[WAVE_MANIFEST.json](../plan/WAVE_MANIFEST.json)). The plan derives from these specs; specs win on conflict.
Machine-readable validation status of this tree: [SPEC_STATUS.json](./SPEC_STATUS.json).

## Open Questions

Known gaps and deferred scope live in
[GAPS_AND_QUESTIONS.md](../questions-and-limitations/GAPS_AND_QUESTIONS.md).
