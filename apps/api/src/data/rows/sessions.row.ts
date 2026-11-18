/* Database Entity — mirrors the table columns exactly (persistence/03-row-mappers.md#row-types). */

/** `sessions` */
export type SessionRow = {
  id: string;
  user_id: string;
  /** `bytea` (32 bytes, sha256 of the raw token). */
  token_hash: Buffer;
  user_agent: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
};
