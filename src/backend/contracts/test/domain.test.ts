import { test } from "node:test";
import assert from "node:assert/strict";
import { DomainError, isDomainError } from "../domain/shared/errors.ts";
import { parsePublicId, toPublicId } from "../domain/shared/public-id.ts";
import { HASHTAG_REGEX, RESERVED_USERNAMES, STORY_TTL_MS } from "../domain/shared/limits.ts";
import { isSessionActive } from "../domain/identity.ts";
import { isStoryActive } from "../domain/stories.ts";
import { hasValidNotificationRefs } from "../domain/notifications.ts";
import { MEDIA_MIME_TO_EXT, MEDIA_MIME_TO_KIND } from "../domain/media.ts";
import { MEDIA_MIME_TYPES, USERNAME_PATTERN } from "../wire/limits.ts";

const UUID = "0190f3c2-a1b4-7c3e-9d1f-2a3b4c5d6e7f";

test("toPublicId / parsePublicId round trip", () => {
  const pub = toPublicId("usr", UUID);
  assert.equal(pub, "usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f");
  assert.equal(parsePublicId("usr", pub), UUID);
});

test("parsePublicId rejects wrong prefix, uppercase, bad length with VALIDATION_FAILED", () => {
  for (const bad of [
    "pst_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f",
    "usr_0190F3C2A1B47C3E9D1F2A3B4C5D6E7F",
    "usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7",
    "usr_",
    "",
    "usr_0190f3c2a1b47c3e9d1f2a3b4c5d6e7f ",
  ]) {
    assert.throws(
      () => parsePublicId("usr", bad),
      (e: unknown) => isDomainError(e) && e.code === "VALIDATION_FAILED",
      `expected rejection of ${JSON.stringify(bad)}`,
    );
  }
});

test("toPublicId refuses a non-canonical UUID", () => {
  assert.throws(() => toPublicId("usr", "not-a-uuid"), DomainError);
  assert.throws(() => toPublicId("usr", UUID.toUpperCase()), DomainError);
});

test("DomainError carries code, message and details", () => {
  const e = new DomainError("FORBIDDEN", "nope", { a: 1 });
  assert.equal(e.code, "FORBIDDEN");
  assert.equal(e.message, "nope");
  assert.deepEqual(e.details, { a: 1 });
  assert.ok(e instanceof Error);
  assert.equal(e.name, "DomainError");
});

test("isSessionActive: active, expired at the boundary, revoked", () => {
  const expiresAt = new Date("2026-12-01T00:00:00.000Z");
  assert.equal(isSessionActive({ revokedAt: null, expiresAt }, new Date("2026-11-30T23:59:59.999Z")), true);
  assert.equal(isSessionActive({ revokedAt: null, expiresAt }, expiresAt), false);
  assert.equal(isSessionActive({ revokedAt: new Date(0), expiresAt }, new Date("2026-11-01T00:00:00.000Z")), false);
});

test("isStoryActive: visible strictly before expires_at (INV-06)", () => {
  const createdAt = new Date("2026-11-17T10:00:00.000Z");
  const expiresAt = new Date(createdAt.getTime() + STORY_TTL_MS);
  assert.equal(isStoryActive({ expiresAt }, new Date(expiresAt.getTime() - 1)), true);
  assert.equal(isStoryActive({ expiresAt }, expiresAt), false);
});

test("notification type/reference combinations mirror the DB CHECK", () => {
  const p = "p" as never;
  const c = "c" as never;
  assert.equal(hasValidNotificationRefs({ type: "follow", postId: null, commentId: null }), true);
  assert.equal(hasValidNotificationRefs({ type: "follow", postId: p, commentId: null }), false);
  assert.equal(hasValidNotificationRefs({ type: "like", postId: p, commentId: null }), true);
  assert.equal(hasValidNotificationRefs({ type: "like", postId: null, commentId: null }), false);
  assert.equal(hasValidNotificationRefs({ type: "like", postId: p, commentId: c }), false);
  assert.equal(hasValidNotificationRefs({ type: "comment", postId: p, commentId: c }), true);
  assert.equal(hasValidNotificationRefs({ type: "comment", postId: p, commentId: null }), false);
});

test("reserved usernames are lowercase and would otherwise pass or fail the pattern consistently", () => {
  for (const name of RESERVED_USERNAMES) {
    assert.equal(name, name.toLowerCase());
  }
  // Short reserved names (p, u, me) are already rejected by the 3-char minimum; longer ones need the list.
  assert.ok(USERNAME_PATTERN.test("explore"));
  assert.ok(!USERNAME_PATTERN.test("me"));
});

test("USERNAME_PATTERN boundaries", () => {
  assert.ok(USERNAME_PATTERN.test("abc"));
  assert.ok(USERNAME_PATTERN.test("a".repeat(30)));
  assert.ok(!USERNAME_PATTERN.test("ab"));
  assert.ok(!USERNAME_PATTERN.test("a".repeat(31)));
  assert.ok(!USERNAME_PATTERN.test("Abc"));
  assert.ok(!USERNAME_PATTERN.test("a-b"));
});

test("HASHTAG_REGEX extracts unicode tags up to 64 chars", () => {
  const tags = [..."Hi #Sun #café #日本 #a_b1 #-no".matchAll(HASHTAG_REGEX)].map((m) => m[1]);
  assert.deepEqual(tags, ["Sun", "café", "日本", "a_b1"]);
  const long = [...`#${"x".repeat(70)}`.matchAll(HASHTAG_REGEX)].map((m) => m[1]);
  assert.equal(long[0]!.length, 64);
});

test("every allowed MIME type has a kind and an extension", () => {
  assert.deepEqual(Object.keys(MEDIA_MIME_TO_KIND).sort(), [...MEDIA_MIME_TYPES].sort());
  assert.deepEqual(Object.keys(MEDIA_MIME_TO_EXT).sort(), [...MEDIA_MIME_TYPES].sort());
});
