import argon2 from "argon2";

import type { PasswordHasher } from "../../domain/identity/ports.js";
import type { PasswordHash } from "../../domain/identity/user.entity.js";

export type Argon2Options = { memoryCost: number; timeCost: number; parallelism: number };

/** OWASP-recommended argon2id baseline (19 MiB, t=2, p=1). Tests may lower the cost. */
export const DEFAULT_ARGON2_OPTIONS: Argon2Options = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

/** argon2id `PasswordHasher` (`F-BE-01`). Plaintext is never stored or logged. */
export class Argon2PasswordHasher implements PasswordHasher {
  constructor(private readonly options: Argon2Options = DEFAULT_ARGON2_OPTIONS) {}

  async hash(pw: string): Promise<PasswordHash> {
    const encoded = await argon2.hash(pw, { type: argon2.argon2id, ...this.options });
    return encoded as PasswordHash;
  }

  /** Malformed stored hashes verify as `false` instead of throwing. */
  async verify(hash: PasswordHash, pw: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, pw);
    } catch {
      return false;
    }
  }
}
