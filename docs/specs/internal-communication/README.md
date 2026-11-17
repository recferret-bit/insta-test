# Internal Communication Specifications

- **Status:** Active

Per `DEC-05`, components communicate through in-process calls (`api` → `domain` services → `data` adapters), an in-process typed domain event bus, and a server → browser SSE stream for live updates. There are no message brokers, queues, or inter-service RPC.

| File | Content |
|---|---|
| [01-shared-contracts.md](./01-shared-contracts.md) | `@insta/contracts` workspace package: DTO schemas, error codes, IDs, event schemas, versioning |
| [02-domain-events-and-sse.md](./02-domain-events-and-sse.md) | Domain events, after-commit publishing, SSE hub, ticket auth, event payloads, reconnection & idempotency |

## Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| `F-ICOMM-01` | Shared contracts package | `packages/contracts` builds standalone, exports every DTO schema + inferred types; both `apps/api` and `apps/web` compile against it; no runtime deps other than `zod`. |
| `F-ICOMM-02` | In-process domain event bus | Events are published only after the DB transaction commits; a rolled-back tx publishes nothing (unit test with failing repo). |
| `F-ICOMM-03` | SSE stream with ticket auth | `POST /events/ticket` → `GET /events/stream?ticket=` works once; reused/expired ticket → 401; heartbeat every 25 s. |
| `F-ICOMM-04` | Live notification delivery | A like/comment/follow by user A is received by B's open stream as `notification.created` within 1 s in the integration test. |
| `F-ICOMM-05` | Client reconciliation | On reconnect the web client refetches unread count and invalidates notification queries; duplicate events (same `id`) are ignored. |
