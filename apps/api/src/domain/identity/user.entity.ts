import type { Brand, MediaId, UserId } from "../shared/ids.js";

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
