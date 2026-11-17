import { createHash, randomBytes } from "node:crypto";

import type { TokenGenerator } from "../../domain/identity/ports.js";

/** sha256 of the raw token string, as stored in `sessions.token_hash` (same as `IdentityService.authenticate`). */
export function hashToken(raw: string): Buffer {
  return createHash("sha256").update(raw, "utf8").digest();
}

/** 32 random bytes → base64url (43 chars) raw token + sha256 hash (`INV-09`). */
export class RandomTokenGenerator implements TokenGenerator {
  generate(): { raw: string; hash: Buffer } {
    const raw = randomBytes(32).toString("base64url");
    return { raw, hash: hashToken(raw) };
  }
}
