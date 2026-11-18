import { beforeEach, describe, expect, it } from "vitest";

import { IdentityService } from "../../../src/domain/identity/identity.service.js";
import type { MediaAsset } from "../../../src/domain/media/media-asset.entity.js";
import type { DomainError } from "../../../src/domain/shared/errors.js";
import type { MediaId, SessionId, UserId } from "../../../src/domain/shared/ids.js";
import { FakeClock } from "../../helpers/clock.js";
import {
  FakeHasher,
  FakeMedia,
  FakeSessions,
  FakeUnitOfWork,
  FakeUsers,
  SeqIds,
  SeqTokens,
} from "./fakes.js";

const NOW = "2026-11-17T10:00:00.000Z";

function setup() {
  const users = new FakeUsers();
  const sessions = new FakeSessions();
  const media = new FakeMedia();
  const hasher = new FakeHasher();
  const clock = new FakeClock(NOW);
  const uow = new FakeUnitOfWork([users, sessions, media] as never);
  const service = new IdentityService({
    users,
    sessions,
    media,
    passwordHasher: hasher,
    tokens: new SeqTokens(),
    uow,
    clock,
    ids: new SeqIds(),
    sessionTtlDays: 30,
  });
  return { service, users, sessions, media, hasher, clock, uow };
}

type Ctx = ReturnType<typeof setup>;

async function expectCode(p: Promise<unknown>, code: string): Promise<DomainError> {
  const err = (await p.then(
    () => {
      throw new Error(`expected ${code}`);
    },
    (e: unknown) => e,
  )) as DomainError;
  expect(err.code).toBe(code);
  return err;
}

const signup = {
  username: "  Alice.B ",
  email: "Alice@Example.com",
  password: "s3cret-pass",
  fullName: " Alice ",
  userAgent: "vitest-ua",
};

function avatar(ownerId: UserId, over: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "0190b000-0000-7000-8000-000000000001" as MediaId,
    ownerId,
    purpose: "avatar",
    kind: "image",
    mimeType: "image/png",
    storageKey: "2026/11/avatar.png",
    byteSize: 100,
    width: 10,
    height: 10,
    durationMs: null,
    status: "uploaded",
    createdAt: new Date(NOW),
    ...over,
  };
}

describe("IdentityService", () => {
  let c: Ctx;
  beforeEach(() => {
    c = setup();
  });

  describe("register", () => {
    it("normalizes, hashes and stores user + session in one tx", async () => {
      const { user, issued } = await c.service.register(signup);
      expect(user.username).toBe("alice.b");
      expect(user.email).toBe("alice@example.com");
      expect(user.fullName).toBe("Alice");
      expect(user.passwordHash).toBe("hash:s3cret-pass");
      expect(c.uow.runs).toBe(1);
      expect(c.users.rows.get(user.id)).toBeDefined();
      const stored = c.sessions.rows.get(issued.session.id)!;
      expect(stored.userId).toBe(user.id);
      expect(stored.userAgent).toBe("vitest-ua");
      expect(stored.expiresAt.toISOString()).toBe("2026-12-17T10:00:00.000Z");
      expect(issued.rawToken).toHaveLength(43);
      // The raw token authenticates the new session.
      await expect(c.service.authenticate(issued.rawToken)).resolves.toEqual({
        userId: user.id,
        sessionId: issued.session.id,
      });
    });

    it("rejects an invalid / reserved username before hashing", async () => {
      await expectCode(c.service.register({ ...signup, username: "explore" }), "VALIDATION_FAILED");
      await expectCode(c.service.register({ ...signup, username: ".bad" }), "VALIDATION_FAILED");
      await expectCode(c.service.register({ ...signup, email: "nope" }), "VALIDATION_FAILED");
      expect(c.hasher.hashCalls).toBe(0);
    });

    it("USERNAME_TAKEN / EMAIL_TAKEN leave no session behind (tx rollback)", async () => {
      await c.service.register(signup);
      await expectCode(c.service.register({ ...signup, email: "other@example.com" }), "USERNAME_TAKEN");
      await expectCode(c.service.register({ ...signup, username: "other" }), "EMAIL_TAKEN");
      expect(c.users.rows.size).toBe(1);
      expect(c.sessions.rows.size).toBe(1);
    });
  });

  describe("login", () => {
    beforeEach(async () => {
      await c.service.register(signup);
    });

    it("accepts username or email, case-insensitive, and issues a new session", async () => {
      const a = await c.service.login({ login: " ALICE.B ", password: "s3cret-pass", userAgent: "x" });
      expect(c.users.lastLogin).toBe("alice.b");
      const b = await c.service.login({
        login: "alice@example.com",
        password: "s3cret-pass",
        userAgent: "y",
      });
      expect(a.user.id).toBe(b.user.id);
      expect(a.issued.rawToken).not.toBe(b.issued.rawToken);
      expect(c.sessions.rows.size).toBe(3);
    });

    it("wrong password → INVALID_CREDENTIALS", async () => {
      await expectCode(
        c.service.login({ login: "alice.b", password: "wrong", userAgent: "" }),
        "INVALID_CREDENTIALS",
      );
      expect(c.sessions.rows.size).toBe(1);
    });

    it("unknown handle → same INVALID_CREDENTIALS after a dummy verify", async () => {
      c.hasher.verifyCalls = [];
      await expectCode(
        c.service.login({ login: "ghost", password: "whatever", userAgent: "" }),
        "INVALID_CREDENTIALS",
      );
      expect(c.hasher.verifyCalls).toHaveLength(1);
      expect(c.hasher.verifyCalls[0]!.pw).toBe("whatever");
      // The dummy hash is computed once and reused.
      const hashes = c.hasher.hashCalls;
      await expectCode(
        c.service.login({ login: "ghost2", password: "x", userAgent: "" }),
        "INVALID_CREDENTIALS",
      );
      expect(c.hasher.hashCalls).toBe(hashes);
    });
  });

  describe("logout", () => {
    it("revokes only the given session", async () => {
      const { issued } = await c.service.register(signup);
      const second = await c.service.login({ login: "alice.b", password: "s3cret-pass", userAgent: "" });
      c.clock.advance(1000);
      await c.service.logout(issued.session.id);
      expect(c.sessions.rows.get(issued.session.id)!.revokedAt?.toISOString()).toBe(
        "2026-11-17T10:00:01.000Z",
      );
      expect(c.sessions.rows.get(second.issued.session.id)!.revokedAt).toBeNull();
      await expect(c.service.authenticate(issued.rawToken)).resolves.toBeNull();
      await expect(
        c.service.logout("0190ffff-0000-7000-8000-000000000000" as SessionId),
      ).resolves.toBeUndefined();
    });
  });

  describe("getMe / getProfile", () => {
    it("getMe returns own view with email", async () => {
      const { user } = await c.service.register(signup);
      const me = await c.service.getMe(user.id);
      expect(me.email).toBe("alice@example.com");
      expect(me.viewerIsFollowing).toBeNull();
    });

    it("getMe → UNAUTHENTICATED when the user vanished", async () => {
      await expectCode(c.service.getMe("0190ffff-0000-7000-8000-000000000000" as UserId), "UNAUTHENTICATED");
    });

    it("getProfile lowercases the path username and hides email from others", async () => {
      const { user } = await c.service.register(signup);
      const other = await c.service.register({ ...signup, username: "bob", email: "bob@example.com" });
      c.users.follows.add(`${other.user.id}->${user.id}`);
      const view = await c.service.getProfile("ALICE.B", other.user.id);
      expect(view.id).toBe(user.id);
      expect(view.email).toBeUndefined();
      expect(view.viewerIsFollowing).toBe(true);
      const anon = await c.service.getProfile("alice.b");
      expect(anon.viewerIsFollowing).toBeNull();
    });

    it("getProfile → NOT_FOUND", async () => {
      await expectCode(c.service.getProfile("nobody"), "NOT_FOUND");
    });
  });

  describe("updateProfile", () => {
    let userId: UserId;
    beforeEach(async () => {
      userId = (await c.service.register(signup)).user.id;
      c.clock.advance(60_000);
    });

    it("updates fields and bumps updatedAt", async () => {
      const view = await c.service.updateProfile({
        userId,
        username: "Alice2",
        fullName: "A",
        bio: "hi\nthere",
      });
      expect(view.username).toBe("alice2");
      expect(view.fullName).toBe("A");
      expect(view.bio).toBe("hi\nthere");
      expect(view.email).toBe("alice@example.com");
      expect(c.users.rows.get(userId)!.updatedAt.toISOString()).toBe("2026-11-17T10:01:00.000Z");
    });

    it("rejects invalid bio / username", async () => {
      await expectCode(c.service.updateProfile({ userId, bio: "a\nb\nc\nd\ne\nf" }), "VALIDATION_FAILED");
      await expectCode(c.service.updateProfile({ userId, username: "me" }), "VALIDATION_FAILED");
    });

    it("USERNAME_TAKEN when another user owns the username", async () => {
      await c.service.register({ ...signup, username: "bob", email: "bob@example.com" });
      await expectCode(c.service.updateProfile({ userId, username: "bob" }), "USERNAME_TAKEN");
    });

    it("attaches an owned uploaded avatar image in the same tx", async () => {
      const asset = avatar(userId);
      c.media.rows.set(asset.id, asset);
      c.users.avatarKeys.set(asset.id, asset.storageKey);
      const view = await c.service.updateProfile({ userId, avatarMediaId: asset.id });
      expect(view.avatarStorageKey).toBe(asset.storageKey);
      expect(c.media.rows.get(asset.id)!.status).toBe("attached");
      // Re-sending the current avatar is a no-op, not MEDIA_INVALID.
      await c.service.updateProfile({ userId, avatarMediaId: asset.id });
      expect(c.media.attachCalls).toHaveLength(1);
      // null removes it.
      const cleared = await c.service.updateProfile({ userId, avatarMediaId: null });
      expect(cleared.avatarStorageKey).toBeNull();
      expect(c.users.rows.get(userId)!.avatarMediaId).toBeNull();
    });

    it.each([
      ["missing", null],
      ["someone else's", { ownerId: "0190ffff-0000-7000-8000-000000000000" as UserId }],
      ["post purpose", { purpose: "post" as const }],
      ["already attached", { status: "attached" as const }],
      ["video", { kind: "video" as const, mimeType: "video/mp4" as const }],
    ])("MEDIA_INVALID for %s media and nothing is written", async (_label, over) => {
      const asset = avatar(userId, over ?? {});
      if (over !== null) c.media.rows.set(asset.id, asset);
      await expectCode(
        c.service.updateProfile({ userId, fullName: "Changed", avatarMediaId: asset.id }),
        "MEDIA_INVALID",
      );
      expect(c.users.rows.get(userId)!.fullName).toBe("Alice");
      expect(c.media.attachCalls).toHaveLength(0);
    });

    it("UNAUTHENTICATED when the user vanished", async () => {
      await expectCode(
        c.service.updateProfile({ userId: "0190ffff-0000-7000-8000-000000000000" as UserId, bio: "x" }),
        "UNAUTHENTICATED",
      );
    });
  });
});
