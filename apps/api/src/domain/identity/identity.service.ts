import { createHash } from "node:crypto";

import { MediaAsset } from "../media/media-asset.entity.js";
import type { MediaRepository } from "../media/ports.js";
import type { Clock } from "../shared/clock.js";
import { DomainError } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { MediaId, SessionId, UserId } from "../shared/ids.js";
import type { Tx, UnitOfWork } from "../shared/unit-of-work.js";
import type { LoginCommand, RegisterUserCommand, UpdateProfileCommand } from "./commands.js";
import type { PasswordHasher, SessionRepository, TokenGenerator, UserRepository } from "./ports.js";
import { Session, type AuthContext, type IssuedSession } from "./session.entity.js";
import { Email, User, Username, type PasswordHash } from "./user.entity.js";
import type { UserProfileView } from "./views.js";

export type IdentityServiceDeps = {
  users: UserRepository;
  sessions: SessionRepository;
  media: MediaRepository;
  passwordHasher: PasswordHasher;
  tokens: TokenGenerator;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
  /** Session lifetime in days (`SESSION_TTL_DAYS`, default 30). */
  sessionTtlDays: number;
};

/** Plaintext hashed once per process to make unknown-handle logins cost one real argon2 verify. */
const DUMMY_PASSWORD = "insta-dummy-password-for-timing";

function invalidCredentials(): DomainError {
  return new DomainError("INVALID_CREDENTIALS", "Invalid credentials");
}

function unauthenticated(): DomainError {
  return new DomainError("UNAUTHENTICATED", "Authentication required");
}

/** `F-BE-01` — identity & sessions (backend/02-services-and-use-cases.md#identityservice). */
export class IdentityService {
  private dummyHash: Promise<PasswordHash> | undefined;

  constructor(private readonly deps: IdentityServiceDeps) {}

  /** `VALIDATION_FAILED`, `USERNAME_TAKEN`, `EMAIL_TAKEN`. User + session are inserted in one tx. */
  async register(cmd: RegisterUserCommand): Promise<{ user: User; issued: IssuedSession }> {
    // Cheap validation first so invalid input never pays for an argon2 hash.
    Username.parse(cmd.username);
    Email.parse(cmd.email);
    const passwordHash = await this.deps.passwordHasher.hash(cmd.password);
    const now = this.deps.clock.now();
    const user = User.register({
      id: this.deps.ids.uuidv7() as UserId,
      username: cmd.username,
      email: cmd.email,
      passwordHash,
      fullName: cmd.fullName,
      now,
    });
    const issued = this.issueSession(user.id, cmd.userAgent, now);
    await this.deps.uow.run(async (tx) => {
      await this.deps.users.insert(user, tx);
      await this.deps.sessions.insert(issued.session, tx);
    });
    return { user, issued };
  }

  /** `INVALID_CREDENTIALS` for unknown handle or wrong password (dummy verify keeps timing comparable). */
  async login(cmd: LoginCommand): Promise<{ user: User; issued: IssuedSession }> {
    const user = await this.deps.users.findByLogin(cmd.login.trim().toLowerCase());
    if (!user) {
      await this.deps.passwordHasher.verify(await this.getDummyHash(), cmd.password);
      throw invalidCredentials();
    }
    const ok = await this.deps.passwordHasher.verify(user.passwordHash, cmd.password);
    if (!ok) throw invalidCredentials();
    const issued = this.issueSession(user.id, cmd.userAgent, this.deps.clock.now());
    await this.deps.sessions.insert(issued.session);
    return { user, issued };
  }

  /** Revokes the current session only (idempotent). */
  async logout(sessionId: SessionId): Promise<void> {
    await this.deps.sessions.revoke(sessionId, this.deps.clock.now());
  }

  /** sha256(rawToken) → active session lookup. Implemented in w00 so the auth plugin works. */
  async authenticate(rawToken: string): Promise<AuthContext | null> {
    if (rawToken.length === 0) return null;
    const hash = createHash("sha256").update(rawToken, "utf8").digest();
    const session = await this.deps.sessions.findActiveByTokenHash(hash, this.deps.clock.now());
    return session ? { userId: session.userId, sessionId: session.id } : null;
  }

  /** Own profile incl. email; `UNAUTHENTICATED` if the user vanished. */
  async getMe(userId: UserId): Promise<UserProfileView> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw unauthenticated();
    return this.ownProfileView(user);
  }

  /** `VALIDATION_FAILED`, `USERNAME_TAKEN`, `MEDIA_INVALID`; avatar attach + user update in one tx. */
  async updateProfile(cmd: UpdateProfileCommand): Promise<UserProfileView> {
    const updated = await this.deps.uow.run(async (tx) => {
      const user = await this.deps.users.findById(cmd.userId, tx);
      if (!user) throw unauthenticated();
      const next = User.updateProfile(
        user,
        {
          username: cmd.username,
          fullName: cmd.fullName,
          bio: cmd.bio,
          avatarMediaId: cmd.avatarMediaId,
        },
        this.deps.clock.now(),
      );
      // Re-sending the current avatar is a no-op instead of `MEDIA_INVALID` (already attached).
      if (cmd.avatarMediaId && cmd.avatarMediaId !== user.avatarMediaId) {
        await this.attachAvatar(cmd.avatarMediaId, user.id, tx);
      }
      await this.deps.users.update(next, tx);
      return next;
    });
    return this.ownProfileView(updated);
  }

  /** `NOT_FOUND`. Path usernames are case-insensitive. */
  async getProfile(username: string, viewerId: UserId | null = null): Promise<UserProfileView> {
    const view = await this.deps.users.getProfileView(username.trim().toLowerCase() as Username, viewerId);
    if (!view) throw new DomainError("NOT_FOUND", "User not found");
    return view;
  }

  private issueSession(userId: UserId, userAgent: string, now: Date): IssuedSession {
    const { raw, hash } = this.deps.tokens.generate();
    const session = Session.issue({
      id: this.deps.ids.uuidv7() as SessionId,
      userId,
      tokenHash: hash,
      userAgent,
      now,
      ttlDays: this.deps.sessionTtlDays,
    });
    return { session, rawToken: raw };
  }

  private async attachAvatar(mediaId: MediaId, ownerId: UserId, tx: Tx): Promise<void> {
    const [asset] = await this.deps.media.findManyForUpdate([mediaId], tx);
    if (!asset) throw new DomainError("MEDIA_INVALID", "Media not found");
    MediaAsset.assertAttachable(asset, { ownerId, purpose: "avatar", kind: "image" });
    await this.deps.media.markAttached([mediaId], tx);
  }

  private async ownProfileView(user: User): Promise<UserProfileView> {
    const view = await this.deps.users.getProfileView(user.username, user.id);
    if (!view) throw unauthenticated();
    return view;
  }

  private getDummyHash(): Promise<PasswordHash> {
    this.dummyHash ??= this.deps.passwordHasher.hash(DUMMY_PASSWORD).catch((err: unknown) => {
      this.dummyHash = undefined;
      throw err;
    });
    return this.dummyHash;
  }
}
