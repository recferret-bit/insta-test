import { DomainError } from "../shared/errors.js";
import type { SessionId, UserId } from "../shared/ids.js";
import { DOMAIN_LIMITS } from "../shared/limits.js";

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

const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_HASH_BYTES = 32;

export type IssueSessionInput = {
  id: SessionId;
  userId: UserId;
  tokenHash: Buffer;
  userAgent: string;
  now: Date;
  /** `SESSION_TTL_DAYS` (default 30). */
  ttlDays: number;
};

/** Truncates to 255 code points (never splits a surrogate pair). */
export function truncateUserAgent(userAgent: string): string {
  const chars = Array.from(userAgent);
  return chars.length <= DOMAIN_LIMITS.userAgentMax
    ? userAgent
    : chars.slice(0, DOMAIN_LIMITS.userAgentMax).join("");
}

/** `Session.isActive(now) = revokedAt === null && now < expiresAt`. */
export function isSessionActive(session: Session, now: Date): boolean {
  return session.revokedAt === null && now.getTime() < session.expiresAt.getTime();
}

/** Entity factories for `ENT-Session`. */
export const Session = {
  /** New session: `expiresAt = now + ttlDays`, user agent truncated, not revoked. */
  issue(input: IssueSessionInput): Session {
    if (input.tokenHash.length !== TOKEN_HASH_BYTES) {
      throw new DomainError("INTERNAL", `Session token hash must be ${TOKEN_HASH_BYTES} bytes`);
    }
    if (!Number.isFinite(input.ttlDays) || input.ttlDays <= 0) {
      throw new DomainError("INTERNAL", "Session TTL must be a positive number of days");
    }
    return {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      userAgent: truncateUserAgent(input.userAgent),
      createdAt: input.now,
      expiresAt: new Date(input.now.getTime() + input.ttlDays * DAY_MS),
      revokedAt: null,
    };
  },

  isActive: isSessionActive,

  /** Idempotent: an already revoked session keeps its original `revokedAt`. */
  revoke(session: Session, now: Date): Session {
    return session.revokedAt === null ? { ...session, revokedAt: now } : session;
  },
};
