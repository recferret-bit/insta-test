import type { Session } from "../../domain/identity/session.entity.js";
import type { SessionId, UserId } from "../../domain/shared/ids.js";
import type { SessionRow } from "../rows/sessions.row.js";

/** `ENT-Session` Row → Business Entity (persistence/03-row-mappers.md#mapper-catalog). */
export function mapSessionRowToEntity(row: SessionRow): Session {
  return {
    id: row.id as SessionId,
    userId: row.user_id as UserId,
    tokenHash: row.token_hash,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

/** `ENT-Session` Business Entity → Row; `token_hash` Buffer passthrough. */
export function mapSessionEntityToRow(session: Session): SessionRow {
  return {
    id: session.id,
    user_id: session.userId,
    token_hash: session.tokenHash,
    user_agent: session.userAgent,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
    revoked_at: session.revokedAt,
  };
}
