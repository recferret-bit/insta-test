import type pg from "pg";

import type { SessionRepository } from "../../domain/identity/ports.js";
import type { Session } from "../../domain/identity/session.entity.js";
import type { SessionId } from "../../domain/shared/ids.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";
import { queryable } from "../db/tx.js";
import { mapSessionEntityToRow, mapSessionRowToEntity } from "../mappers/sessions.row-mapper.js";
import type { SessionRow } from "../rows/sessions.row.js";

const SESSION_COLUMNS = "id, user_id, token_hash, user_agent, created_at, expires_at, revoked_at";

/** `sessions` adapter (`F-BE-01`). */
export class PgSessionRepository implements SessionRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insert(s: Session, tx?: Tx): Promise<void> {
    const row = mapSessionEntityToRow(s);
    await queryable(this.pool, tx).query(
      `INSERT INTO sessions (${SESSION_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [row.id, row.user_id, row.token_hash, row.user_agent, row.created_at, row.expires_at, row.revoked_at],
    );
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

  /** Idempotent: an already revoked session keeps its original `revoked_at`. */
  async revoke(id: SessionId, now: Date): Promise<void> {
    await this.pool.query("UPDATE sessions SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL", [
      id,
      now,
    ]);
  }
}
