import { createHash } from "node:crypto";

import type {
  UserCounterDelta,
  UserRepository,
  SessionRepository,
  PasswordHasher,
  TokenGenerator,
} from "../../../src/domain/identity/ports.js";
import type { Session } from "../../../src/domain/identity/session.entity.js";
import type { PasswordHash, User, Username } from "../../../src/domain/identity/user.entity.js";
import { toUserProfileView, type UserProfileView } from "../../../src/domain/identity/views.js";
import type { MediaAsset } from "../../../src/domain/media/media-asset.entity.js";
import type { MediaRepository } from "../../../src/domain/media/ports.js";
import { DomainError } from "../../../src/domain/shared/errors.js";
import { BufferedEventCollector } from "../../../src/domain/shared/events.js";
import type { IdGenerator } from "../../../src/domain/shared/id-generator.js";
import type { MediaId, SessionId, UserId } from "../../../src/domain/shared/ids.js";
import type { Tx, UnitOfWork } from "../../../src/domain/shared/unit-of-work.js";

/** In-memory ports for `IdentityService` unit tests. Writes inside a failed `uow.run` are rolled back. */

export class FakeUsers implements UserRepository {
  rows = new Map<UserId, User>();
  follows = new Set<string>();
  activeStories = new Set<UserId>();
  avatarKeys = new Map<MediaId, string>();

  async insert(user: User): Promise<void> {
    for (const u of this.rows.values()) {
      if (u.username === user.username) throw new DomainError("USERNAME_TAKEN", "Username is already taken");
      if (u.email === user.email) throw new DomainError("EMAIL_TAKEN", "Email is already registered");
    }
    this.rows.set(user.id, structuredClone(user));
  }

  async update(user: User): Promise<void> {
    for (const u of this.rows.values()) {
      if (u.id !== user.id && u.username === user.username) {
        throw new DomainError("USERNAME_TAKEN", "Username is already taken");
      }
    }
    this.rows.set(user.id, structuredClone(user));
  }

  async findById(id: UserId): Promise<User | null> {
    return this.rows.get(id) ?? null;
  }

  async findByUsername(u: Username): Promise<User | null> {
    return [...this.rows.values()].find((x) => x.username === u) ?? null;
  }

  lastLogin: string | undefined;
  async findByLogin(login: string): Promise<User | null> {
    this.lastLogin = login;
    return [...this.rows.values()].find((x) => x.username === login || x.email === login) ?? null;
  }

  async adjustCounters(_id: UserId, _delta: UserCounterDelta, _tx: Tx): Promise<void> {}

  async getProfileView(username: Username, viewerId: UserId | null): Promise<UserProfileView | null> {
    const user = await this.findByUsername(username);
    if (!user) return null;
    return toUserProfileView(user, {
      avatarStorageKey: user.avatarMediaId ? (this.avatarKeys.get(user.avatarMediaId) ?? null) : null,
      viewerId,
      viewerIsFollowing: viewerId ? this.follows.has(`${viewerId}->${user.id}`) : null,
      hasActiveStory: this.activeStories.has(user.id),
    });
  }
}

export class FakeSessions implements SessionRepository {
  rows = new Map<SessionId, Session>();

  async insert(s: Session): Promise<void> {
    this.rows.set(s.id, { ...s });
  }

  async findActiveByTokenHash(hash: Buffer, now: Date): Promise<Session | null> {
    return (
      [...this.rows.values()].find(
        (s) => s.tokenHash.equals(hash) && s.revokedAt === null && now < s.expiresAt,
      ) ?? null
    );
  }

  async revoke(id: SessionId, now: Date): Promise<void> {
    const s = this.rows.get(id);
    if (s && s.revokedAt === null) this.rows.set(id, { ...s, revokedAt: now });
  }
}

export class FakeMedia implements MediaRepository {
  rows = new Map<MediaId, MediaAsset>();
  attachCalls: MediaId[][] = [];

  async insert(m: MediaAsset): Promise<void> {
    this.rows.set(m.id, { ...m });
  }

  async findManyForUpdate(ids: MediaId[]): Promise<MediaAsset[]> {
    return ids.flatMap((id) => (this.rows.has(id) ? [{ ...this.rows.get(id)! }] : []));
  }

  async markAttached(ids: MediaId[]): Promise<void> {
    this.attachCalls.push(ids);
    for (const id of ids) {
      const m = this.rows.get(id);
      if (m) this.rows.set(id, { ...m, status: "attached" });
    }
  }

  async deleteUnattachedOlderThan(): Promise<MediaAsset[]> {
    return [];
  }
}

/** Snapshot/restore of the in-memory stores to emulate `ROLLBACK`. */
export class FakeUnitOfWork implements UnitOfWork {
  runs = 0;
  constructor(private readonly stores: { rows: Map<unknown, unknown> }[]) {}

  async run<T>(fn: (tx: Tx, events: BufferedEventCollector) => Promise<T>): Promise<T> {
    this.runs += 1;
    const snapshots = this.stores.map((s) => new Map(s.rows));
    try {
      return await fn({} as Tx, new BufferedEventCollector());
    } catch (err) {
      this.stores.forEach((s, i) => {
        s.rows = snapshots[i]!;
      });
      throw err;
    }
  }
}

/** Fast, deterministic hasher: `hash:<pw>`; records every verify call. */
export class FakeHasher implements PasswordHasher {
  verifyCalls: { hash: string; pw: string }[] = [];
  hashCalls = 0;

  async hash(pw: string): Promise<PasswordHash> {
    this.hashCalls += 1;
    return `hash:${pw}` as PasswordHash;
  }

  async verify(hash: PasswordHash, pw: string): Promise<boolean> {
    this.verifyCalls.push({ hash, pw });
    return hash === `hash:${pw}`;
  }
}

export class SeqTokens implements TokenGenerator {
  private n = 0;
  generate(): { raw: string; hash: Buffer } {
    this.n += 1;
    const raw = `token-${this.n}`.padEnd(43, "x");
    return { raw, hash: createHash("sha256").update(raw, "utf8").digest() };
  }
}

export class SeqIds implements IdGenerator {
  private n = 0;
  uuidv7(): string {
    this.n += 1;
    return `0190a000-0000-7000-8000-${this.n.toString(16).padStart(12, "0")}`;
  }
}
