import type pg from "pg";

import type { SessionRepository } from "../../domain/identity/ports.js";
import type { Session } from "../../domain/identity/session.entity.js";
import { notImplemented } from "../../domain/shared/errors.js";
import type { SessionId } from "../../domain/shared/ids.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";
import { mapSessionRowToEntity } from "../mappers/sessions.row-mapper.js";
import type { SessionRow } from "../rows/sessions.row.js";

const SESSION_COLUMNS = "id, user_id, token_hash, user_agent, created_at, expires_at, revoked_at";

/** `sessions` adapter. `findActiveByTokenHash` is live since w00 (auth plugin); the rest is w01. */
export class PgSessionRepository implements SessionRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insert(s: Session, tx?: Tx): Promise<void> {
    return notImplemented("PgSessionRepository.insert");
  }

  /** Uses `sessions_token_hash_key`; active = not revoked and `now < expires_at`. */
  async findActiveByTokenHash(hash: Buffer, now: Date): Promise<Session | null> {
    const { rows } = await this.pool.query<SessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM sessions
        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2`,
      [hash, now],
    );
    const row = rows[0];
    return row ? mapSessionRowToEntity(row) : null;
  }

  async revoke(id: SessionId, now: Date): Promise<void> {
    return notImplemented("PgSessionRepository.revoke");
  }
}
