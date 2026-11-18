import { DomainError } from "../shared/errors.js";
import type { Brand, MediaId, UserId } from "../shared/ids.js";
import { DOMAIN_LIMITS } from "../shared/limits.js";

/** Validated & lowercased; `^[a-z0-9._]{3,30}$`, no leading/trailing `.`, not reserved. */
export type Username = Brand<string, "Username">;
/** Validated & lowercased, ≤ 254. */
export type Email = Brand<string, "Email">;
/** argon2id hash string. */
export type PasswordHash = Brand<string, "PasswordHash">;

/** Usernames that collide with SPA/API routes (backend/01-business-entities.md#user). */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "api",
  "admin",
  "explore",
  "me",
  "login",
  "signup",
  "settings",
  "stories",
  "p",
  "u",
  "media",
  "notifications",
  "create",
]);

export type UserStats = { posts: number; followers: number; following: number };

export type User = {
  id: UserId;
  username: Username;
  email: Email;
  passwordHash: PasswordHash;
  /** ≤ 60 */
  fullName: string;
  /** ≤ 150, ≤ 4 newlines */
  bio: string;
  avatarMediaId: MediaId | null;
  stats: UserStats;
  createdAt: Date;
  updatedAt: Date;
};

/** `VALIDATION_FAILED` with a single `{ path, message }` issue (wire field name as `path`). */
function invalid(path: string, message: string): never {
  throw new DomainError("VALIDATION_FAILED", message, [{ path, message }]);
}

const USERNAME_PATTERN = /^[a-z0-9._]+$/;
/** RFC-5322-lite: one `@`, no whitespace, a dot in the domain part. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Value object `Username` — `Username.parse(raw)` trims, lowercases and validates. */
export const Username = {
  parse(raw: string): Username {
    const value = raw.trim().toLowerCase();
    const { usernameMin, usernameMax } = DOMAIN_LIMITS;
    if (value.length < usernameMin || value.length > usernameMax) {
      invalid("username", `Username must be ${usernameMin}–${usernameMax} characters`);
    }
    if (!USERNAME_PATTERN.test(value)) {
      invalid("username", "Only letters, digits, '.' and '_' are allowed");
    }
    if (value.startsWith(".") || value.endsWith(".")) {
      invalid("username", "Must not start or end with '.'");
    }
    if (RESERVED_USERNAMES.has(value)) invalid("username", "This username is reserved");
    return value as Username;
  },
};

/** Value object `Email` — `Email.parse(raw)` trims, lowercases and validates (≤ 254). */
export const Email = {
  parse(raw: string): Email {
    const value = raw.trim().toLowerCase();
    if (value.length > DOMAIN_LIMITS.emailMax || !EMAIL_PATTERN.test(value)) {
      invalid("email", "Invalid email address");
    }
    return value as Email;
  },
};

/** Trimmed, 0–60 chars. */
export function parseFullName(raw: string): string {
  const value = raw.trim();
  if (value.length > DOMAIN_LIMITS.fullNameMax) {
    invalid("full_name", `Full name must be at most ${DOMAIN_LIMITS.fullNameMax} characters`);
  }
  return value;
}

/** 0–150 chars, at most 4 line breaks; stored as typed (not trimmed, same as `BioField`). */
export function parseBio(raw: string): string {
  if (raw.length > DOMAIN_LIMITS.bioMax) {
    invalid("bio", `Bio must be at most ${DOMAIN_LIMITS.bioMax} characters`);
  }
  if ((raw.match(/\n/g)?.length ?? 0) > DOMAIN_LIMITS.bioMaxNewlines) {
    invalid("bio", `At most ${DOMAIN_LIMITS.bioMaxNewlines} line breaks are allowed`);
  }
  return raw;
}

export type RegisterUserInput = {
  id: UserId;
  username: string;
  email: string;
  passwordHash: PasswordHash;
  fullName: string;
  now: Date;
};

/** `avatarMediaId: null` removes the avatar; `undefined` fields stay unchanged. */
export type UserProfileChanges = {
  username?: string;
  fullName?: string;
  bio?: string;
  avatarMediaId?: MediaId | null;
};

/** Entity factories for `ENT-User` (`User.register`, `User.updateProfile`). */
export const User = {
  /** New account: zero counters, empty bio, no avatar, `createdAt = updatedAt = now`. */
  register(input: RegisterUserInput): User {
    return {
      id: input.id,
      username: Username.parse(input.username),
      email: Email.parse(input.email),
      passwordHash: input.passwordHash,
      fullName: parseFullName(input.fullName),
      bio: "",
      avatarMediaId: null,
      stats: { posts: 0, followers: 0, following: 0 },
      createdAt: input.now,
      updatedAt: input.now,
    };
  },

  /**
   * Returns a new `User` with validated changes and `updatedAt = now`. Avatar ownership/purpose is checked by
   * the service via `MediaAsset.assertAttachable` before calling this.
   */
  updateProfile(user: User, changes: UserProfileChanges, now: Date): User {
    return {
      ...user,
      username: changes.username === undefined ? user.username : Username.parse(changes.username),
      fullName: changes.fullName === undefined ? user.fullName : parseFullName(changes.fullName),
      bio: changes.bio === undefined ? user.bio : parseBio(changes.bio),
      avatarMediaId: changes.avatarMediaId === undefined ? user.avatarMediaId : changes.avatarMediaId,
      stats: { ...user.stats },
      updatedAt: now,
    };
  },
};
