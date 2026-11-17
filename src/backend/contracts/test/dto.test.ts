import { test } from "node:test";
import assert from "node:assert/strict";

// Zod-backed DTO tests. Skipped (with a reason) when `zod` is not installed, e.g. before `npm install`.
let wire: typeof import("../wire/index.ts") | null = null;
let skip: string | false = false;
try {
  wire = await import("../wire/index.ts");
} catch (e) {
  skip = `zod not installed: ${(e as Error).message.split("\n")[0]}`;
}

const MED = "med_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f";
const USR = "usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f";
const NOW = "2026-11-17T10:00:00.000Z";

test("SignupRequestDto: normalises, defaults, rejects unknown keys", { skip }, () => {
  const w = wire!;
  const ok = w.SignupRequestDto.parse({ username: " Alice.B ", email: "A@Example.com ", password: "12345678" });
  assert.deepEqual(ok, { username: "alice.b", email: "a@example.com", password: "12345678", full_name: "" });
  assert.equal(w.SignupRequestDto.safeParse({ ...ok, extra: 1 }).success, false);
  assert.equal(w.SignupRequestDto.safeParse({ ...ok, username: ".alice" }).success, false);
  assert.equal(w.SignupRequestDto.safeParse({ ...ok, username: "ab" }).success, false);
  assert.equal(w.SignupRequestDto.safeParse({ ...ok, password: "1234567" }).success, false);
  assert.equal(w.SignupRequestDto.safeParse({ ...ok, password: "x".repeat(129) }).success, false);
});

test("UpdateProfileRequestDto: needs a field, bio newline limit, avatar null allowed", { skip }, () => {
  const w = wire!;
  assert.equal(w.UpdateProfileRequestDto.safeParse({}).success, false);
  assert.equal(w.UpdateProfileRequestDto.safeParse({ avatar_media_id: null }).success, true);
  assert.equal(w.UpdateProfileRequestDto.safeParse({ avatar_media_id: USR }).success, false);
  assert.equal(w.UpdateProfileRequestDto.safeParse({ bio: "a\nb\nc\nd\ne" }).success, true);
  assert.equal(w.UpdateProfileRequestDto.safeParse({ bio: "a\nb\nc\nd\ne\nf" }).success, false);
  assert.equal(w.UpdateProfileRequestDto.safeParse({ bio: "x".repeat(151) }).success, false);
});

test("CreatePostRequestDto: 1..10 unique media, caption ≤ 2200", { skip }, () => {
  const w = wire!;
  const ids = Array.from({ length: 11 }, (_, i) => `med_${i.toString(16).padStart(32, "0")}`);
  assert.equal(w.CreatePostRequestDto.parse({ media_ids: [MED] }).caption, "");
  assert.equal(w.CreatePostRequestDto.safeParse({ media_ids: [] }).success, false);
  assert.equal(w.CreatePostRequestDto.safeParse({ media_ids: ids.slice(0, 10) }).success, true);
  assert.equal(w.CreatePostRequestDto.safeParse({ media_ids: ids }).success, false);
  assert.equal(w.CreatePostRequestDto.safeParse({ media_ids: [MED, MED] }).success, false);
  assert.equal(w.CreatePostRequestDto.safeParse({ media_ids: [MED], caption: "x".repeat(2201) }).success, false);
});

test("PageQuery: default 20, bounds 1..50, coerces strings", { skip }, () => {
  const w = wire!;
  assert.equal(w.PageQuery.parse({}).limit, 20);
  assert.equal(w.PageQuery.parse({ limit: "50" }).limit, 50);
  assert.equal(w.PageQuery.safeParse({ limit: "0" }).success, false);
  assert.equal(w.PageQuery.safeParse({ limit: "51" }).success, false);
});

test("search queries strip @ / # and lowercase", { skip }, () => {
  const w = wire!;
  assert.equal(w.UserSearchQuery.parse({ q: "@Alice" }).q, "alice");
  assert.equal(w.HashtagSearchQuery.parse({ q: "#Sun" }).q, "sun");
  assert.equal(w.UserSearchQuery.safeParse({ q: "@" }).success, false);
  assert.equal(w.UserSearchQuery.safeParse({ q: "a", limit: "31" }).success, false);
});

test("ErrorResponseDto and ServerEvent parse spec examples", { skip }, () => {
  const w = wire!;
  assert.equal(
    w.ErrorResponseDto.safeParse({ error: { code: "VALIDATION_FAILED", message: "m", details: [{ path: "caption", message: "x" }], request_id: "r" } }).success,
    true,
  );
  assert.equal(w.ErrorResponseDto.safeParse({ error: { code: "NOPE", message: "m", request_id: "r" } }).success, false);
  assert.equal(w.ServerEvent.safeParse({ type: "notification.unread_count", data: { unread_count: 3 } }).success, true);
  assert.equal(w.ServerEvent.safeParse({ type: "unknown", data: {} }).success, false);
});

test("Response DTOs accept additive fields and require ms-precision UTC timestamps", { skip }, () => {
  const w = wire!;
  const media = {
    id: MED, kind: "image", purpose: "post", mime_type: "image/png", url: "http://x/media/k",
    width: 10, height: 10, duration_ms: null, size_bytes: 5, created_at: NOW, extra: true,
  };
  assert.equal(w.MediaResponseDto.safeParse(media).success, true);
  assert.equal(w.MediaResponseDto.safeParse({ ...media, created_at: "2026-11-17T10:00:00Z" }).success, false);
});
