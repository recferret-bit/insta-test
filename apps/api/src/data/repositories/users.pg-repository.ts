import type pg from "pg";

import type { UserCounterDelta, UserRepository } from "../../domain/identity/ports.js";
import type { User, Username } from "../../domain/identity/user.entity.js";
import type { UserProfileView } from "../../domain/identity/views.js";
import { notImplemented } from "../../domain/shared/errors.js";
import type { UserId } from "../../domain/shared/ids.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";

/** `users` adapter — w00 stub; implemented by w01 (identity). */
export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insert(user: User, tx?: Tx): Promise<void> {
    return notImplemented("PgUserRepository.insert");
  }

  async update(user: User, tx?: Tx): Promise<void> {
    return notImplemented("PgUserRepository.update");
  }

  async findById(id: UserId, tx?: Tx): Promise<User | null> {
    return notImplemented("PgUserRepository.findById");
  }

  async findByUsername(u: Username, tx?: Tx): Promise<User | null> {
    return notImplemented("PgUserRepository.findByUsername");
  }

  async findByLogin(login: string, tx?: Tx): Promise<User | null> {
    return notImplemented("PgUserRepository.findByLogin");
  }

  async adjustCounters(id: UserId, delta: UserCounterDelta, tx: Tx): Promise<void> {
    return notImplemented("PgUserRepository.adjustCounters");
  }

  async getProfileView(username: Username, viewerId: UserId | null): Promise<UserProfileView | null> {
    return notImplemented("PgUserRepository.getProfileView");
  }
}
