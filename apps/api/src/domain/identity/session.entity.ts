import type { SessionId, UserId } from "../shared/ids.js";

export type Session = {
  id: SessionId;
  userId: UserId;
  /** sha256(rawToken), 32 bytes. */
  tokenHash: Buffer;
  /** Truncated to 255 chars. */
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

/** `rawToken` exists only in memory for the signup/login response (`INV-09`). */
export type IssuedSession = { session: Session; rawToken: string };

/** Resolved bearer identity attached to each authenticated request. */
export type AuthContext = { userId: UserId; sessionId: SessionId };

/** `Session.isActive(now) = revokedAt === null && now < expiresAt`. */
export function isSessionActive(session: Session, now: Date): boolean {
  return session.revokedAt === null && now.getTime() < session.expiresAt.getTime();
}
