import type { Brand, MediaId, SessionId, UserId } from "./shared/ids.ts";

/** ENT-User / ENT-Session business entities (backend/01-business-entities.md#user, #session). */

export type Username = Brand<string, "Username">; // validated & lowercased
export type Email = Brand<string, "Email">; // validated & lowercased
export type PasswordHash = Brand<string, "PasswordHash">; // argon2id

export type UserStats = { posts: number; followers: number; following: number };

export type User = {
  id: UserId;
  username: Username;
  email: Email;
  passwordHash: PasswordHash;
  fullName: string; // ≤ 60
  bio: string; // ≤ 150, ≤ 4 newlines
  avatarMediaId: MediaId | null;
  stats: UserStats;
  createdAt: Date;
  updatedAt: Date;
};

export type UserSummaryView = {
  id: UserId;
  username: Username;
  fullName: string;
  avatarStorageKey: string | null;
  /** `null` when anonymous or self. */
  viewerIsFollowing: boolean | null;
};

export type UserProfileView = UserSummaryView & {
  bio: string;
  stats: UserStats;
  hasActiveStory: boolean;
  createdAt: Date;
  /** Only populated for the viewer's own profile. */
  email?: Email;
};

export type Session = {
  id: SessionId;
  userId: UserId;
  tokenHash: Buffer; // sha256(rawToken), 32 bytes
  userAgent: string; // ≤ 255
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

/** `rawToken` exists only in memory for the signup/login response (INV-09). */
export type IssuedSession = { session: Session; rawToken: string };

/** Resolved from a bearer token by the auth plugin. */
export type AuthContext = { userId: UserId; sessionId: SessionId };

export type RegisterUserCommand = { username: string; email: string; password: string; fullName: string };
export type LoginCommand = { login: string; password: string; userAgent: string };
export type UpdateProfileCommand = {
  userId: UserId;
  username?: string;
  fullName?: string;
  bio?: string;
  /** `null` clears the avatar; `undefined` leaves it unchanged. */
  avatarMediaId?: MediaId | null;
};

export function isSessionActive(session: Pick<Session, "revokedAt" | "expiresAt">, now: Date): boolean {
  return session.revokedAt === null && now.getTime() < session.expiresAt.getTime();
}
