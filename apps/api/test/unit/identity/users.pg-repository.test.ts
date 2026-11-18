import type pg from "pg";
import { describe, expect, it } from "vitest";

import { PgUserRepository } from "../../../src/data/repositories/users.pg-repository.js";
import { User, type PasswordHash } from "../../../src/domain/identity/user.entity.js";
import type { UserId } from "../../../src/domain/shared/ids.js";

function failingPool(err: unknown): pg.Pool {
  return {
    query: async () => {
      throw err;
    },
  } as unknown as pg.Pool;
}

const user = User.register({
  id: "0190a000-0000-7000-8000-000000000001" as UserId,
  username: "alice",
  email: "alice@example.com",
  passwordHash: "h" as PasswordHash,
  fullName: "",
  now: new Date("2026-11-17T10:00:00.000Z"),
});

describe("PgUserRepository 23505 translation", () => {
  it.each([
    ["users_username_key", "USERNAME_TAKEN"],
    ["users_email_key", "EMAIL_TAKEN"],
  ])("insert: %s → %s", async (constraint, code) => {
    const repo = new PgUserRepository(failingPool({ code: "23505", constraint }));
    await expect(repo.insert(user)).rejects.toMatchObject({ code });
  });

  it("update: users_username_key → USERNAME_TAKEN", async () => {
    const repo = new PgUserRepository(failingPool({ code: "23505", constraint: "users_username_key" }));
    await expect(repo.update(user)).rejects.toMatchObject({ code: "USERNAME_TAKEN" });
  });

  it("other pg errors pass through unchanged", async () => {
    const raw = { code: "23505", constraint: "users_pkey" };
    const repo = new PgUserRepository(failingPool(raw));
    await expect(repo.insert(user)).rejects.toBe(raw);
  });
});
