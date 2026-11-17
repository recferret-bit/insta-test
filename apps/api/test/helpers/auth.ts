import { RandomTokenGenerator } from "../../src/data/crypto/token-generator.js";
import type { Queryable } from "../../src/data/db/tx.js";
import type { SessionRow } from "../../src/data/rows/sessions.row.js";
import type { UserRow } from "../../src/data/rows/users.row.js";
import { insertSession, insertUser, type InsertUserInput } from "./factories.js";

export type AuthedUser = {
  user: UserRow;
  session: SessionRow;
  /** Raw bearer token (what the client holds). */
  token: string;
  /** Ready-made `inject({ headers })` value. */
  headers: { authorization: string };
};

const tokens = new RandomTokenGenerator();

/**
 * Inserts a user plus an active session (SQL level) and returns the raw bearer token.
 * `session` overrides allow expired (`expires_at`) or revoked (`revoked_at`) sessions.
 */
export async function createAuthedUser(
  db: Queryable,
  options: { user?: InsertUserInput; session?: Partial<Omit<SessionRow, "user_id" | "token_hash">> } = {},
): Promise<AuthedUser> {
  const user = await insertUser(db, options.user);
  const { raw, hash } = tokens.generate();
  const session = await insertSession(db, { ...options.session, user_id: user.id, token_hash: hash });
  return { user, session, token: raw, headers: { authorization: `Bearer ${raw}` } };
}
