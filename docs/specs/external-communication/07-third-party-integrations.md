# 07 — Third-Party Integrations

Feature: `F-ECOMM-12`.

**Third-party integrations: Not applicable — owner decision `DEC-06`: the product runs fully self-contained with no outbound calls to external services.**

| Capability often outsourced | How it is handled instead |
|---|---|
| Object storage / CDN (S3, CloudFront) | Local Docker volume `media` mounted at `MEDIA_DIR`, served by the API (`GET /media/*`) |
| Image/video processing services | Not performed in v1 (`DEC-13`); size/type/duration limits enforced on upload |
| Email (verification, password reset) | Not in v1; no email verification; password reset deferred (`Q-05`) |
| Push notifications (APNs/FCM/Web Push) | In-app SSE only |
| OAuth / social login | Username/email + password only |
| Analytics / error tracking SaaS | Structured JSON logs to stdout only |

## Rules

- `apps/api/src` MUST NOT perform outbound HTTP/HTTPS requests (no `fetch`, `undici`, `axios`, `http.request`) outside tests.
- Libraries used locally (argon2, file-type, image-size) are in-process dependencies, not integrations.
- Adding any third-party integration requires a new `DEC-*` and an update of this file first.
