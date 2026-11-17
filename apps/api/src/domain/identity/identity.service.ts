import { createHash } from "node:crypto";

import type { MediaRepository } from "../media/ports.js";
import type { Clock } from "../shared/clock.js";
import { notImplemented } from "../shared/errors.js";
import type { IdGenerator } from "../shared/id-generator.js";
import type { SessionId, UserId } from "../shared/ids.js";
import type { UnitOfWork } from "../shared/unit-of-work.js";
import type { LoginCommand, RegisterUserCommand, UpdateProfileCommand } from "./commands.js";
import type { PasswordHasher, SessionRepository, TokenGenerator, UserRepository } from "./ports.js";
import type { AuthContext, IssuedSession } from "./session.entity.js";
import type { User } from "./user.entity.js";
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

/** `F-BE-01` — identity & sessions (backend/02-services-and-use-cases.md#identityservice). */
export class IdentityService {
  constructor(private readonly deps: IdentityServiceDeps) {}

  /** `VALIDATION_FAILED`, `USERNAME_TAKEN`, `EMAIL_TAKEN`. */
  async register(cmd: RegisterUserCommand): Promise<{ user: User; issued: IssuedSession }> {
    return notImplemented("IdentityService.register");
  }

  /** `INVALID_CREDENTIALS` (dummy verify when the handle is unknown). */
  async login(cmd: LoginCommand): Promise<{ user: User; issued: IssuedSession }> {
    return notImplemented("IdentityService.login");
  }

  async logout(sessionId: SessionId): Promise<void> {
    return notImplemented("IdentityService.logout");
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
    return notImplemented("IdentityService.getMe");
  }

  /** `VALIDATION_FAILED`, `USERNAME_TAKEN`, `MEDIA_INVALID`. */
  async updateProfile(cmd: UpdateProfileCommand): Promise<UserProfileView> {
    return notImplemented("IdentityService.updateProfile");
  }

  /** `NOT_FOUND`. */
  async getProfile(username: string, viewerId: UserId | null = null): Promise<UserProfileView> {
    return notImplemented("IdentityService.getProfile");
  }
}
