import type { SessionId, UserId } from "../shared/ids.js";
import type { Tx } from "../shared/unit-of-work.js";
import type { Session } from "./session.entity.js";
import type { PasswordHash, User, Username } from "./user.entity.js";
import type { UserProfileView } from "./views.js";

export type UserCounterDelta = Partial<{ posts: number; followers: number; following: number }>;

export interface UserRepository {
  /** Translates 23505 on `users_username_key` / `users_email_key` to `USERNAME_TAKEN` / `EMAIL_TAKEN`. */
  insert(user: User, tx?: Tx): Promise<void>;
  update(user: User, tx?: Tx): Promise<void>;
  findById(id: UserId, tx?: Tx): Promise<User | null>;
  findByUsername(u: Username, tx?: Tx): Promise<User | null>;
  /** Username or email (lowercased). */
  findByLogin(login: string, tx?: Tx): Promise<User | null>;
  adjustCounters(id: UserId, delta: UserCounterDelta, tx: Tx): Promise<void>;
  getProfileView(username: Username, viewerId: UserId | null): Promise<UserProfileView | null>;
}

export interface SessionRepository {
  insert(s: Session, tx?: Tx): Promise<void>;
  findActiveByTokenHash(hash: Buffer, now: Date): Promise<Session | null>;
  revoke(id: SessionId, now: Date): Promise<void>;
}

/** argon2id adapter (`data/crypto/`). */
export interface PasswordHasher {
  hash(pw: string): Promise<PasswordHash>;
  verify(hash: PasswordHash, pw: string): Promise<boolean>;
}

/** 32 random bytes → `raw` base64url (43 chars) + `hash` sha256 (`data/crypto/`). */
export interface TokenGenerator {
  generate(): { raw: string; hash: Buffer };
}
