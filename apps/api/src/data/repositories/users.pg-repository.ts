import type pg from "pg";

import type { UserCounterDelta, UserRepository } from "../../domain/identity/ports.js";
import type { User, Username } from "../../domain/identity/user.entity.js";
import type { UserProfileView } from "../../domain/identity/views.js";
import { DomainError } from "../../domain/shared/errors.js";
import type { UserId } from "../../domain/shared/ids.js";
import type { Tx } from "../../domain/shared/unit-of-work.js";
import { isUniqueViolation } from "../db/pg-errors.js";
import { queryable } from "../db/tx.js";
import {
  mapUserEntityToRow,
  mapUserProfileViewRow,
  mapUserRowToEntity,
} from "../mappers/users.row-mapper.js";
import type { UserProfileViewRow, UserRow } from "../rows/users.row.js";

const USER_COLUMNS =
  "id, username, email, password_hash, full_name, bio, avatar_media_id, " +
  "posts_count, followers_count, following_count, created_at, updated_at";

/**
 * Profile read model: avatar key via LEFT JOIN, viewer follow flag (`NULL` for anonymous/self),
 * active-story `EXISTS`, and `email` only for the viewer's own profile. `$1` username, `$2` viewer.
 */
const PROFILE_VIEW_SQL = `
  SELECT u.id, u.username, u.full_name,
         m.storage_key AS avatar_storage_key,
         CASE WHEN $2::uuid IS NULL OR $2::uuid = u.id THEN NULL
              ELSE EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $2::uuid AND f.followee_id = u.id)
         END AS is_following,
         u.bio, u.posts_count, u.followers_count, u.following_count,
         EXISTS (SELECT 1 FROM stories s WHERE s.author_id = u.id AND s.expires_at > now()) AS has_active_story,
         u.created_at,
         CASE WHEN u.id = $2::uuid THEN u.email END AS email
    FROM users u
    LEFT JOIN media_assets m ON m.id = u.avatar_media_id
   WHERE u.username = $1`;

/** 23505 on `users_username_key` / `users_email_key` → `USERNAME_TAKEN` / `EMAIL_TAKEN` (persistence/03). */
function translateUniqueViolation(err: unknown): unknown {
  if (isUniqueViolation(err, "users_username_key")) {
    return new DomainError("USERNAME_TAKEN", "Username is already taken");
  }
  if (isUniqueViolation(err, "users_email_key")) {
    return new DomainError("EMAIL_TAKEN", "Email is already registered");
  }
  return err;
}

/** `users` adapter (`F-BE-01`). */
export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: pg.Pool) {}

  async insert(user: User, tx?: Tx): Promise<void> {
    const row = mapUserEntityToRow(user);
    try {
      await queryable(this.pool, tx).query(
        `INSERT INTO users (${USER_COLUMNS})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          row.id,
          row.username,
          row.email,
          row.password_hash,
          row.full_name,
          row.bio,
          row.avatar_media_id,
          row.posts_count,
          row.followers_count,
          row.following_count,
          row.created_at,
          row.updated_at,
        ],
      );
    } catch (err) {
      throw translateUniqueViolation(err);
    }
  }

  /** Writes mutable profile/credential columns; counters change only via `adjustCounters` (no lost updates). */
  async update(user: User, tx?: Tx): Promise<void> {
    const row = mapUserEntityToRow(user);
    try {
      await queryable(this.pool, tx).query(
        `UPDATE users
            SET username = $2, email = $3, password_hash = $4, full_name = $5, bio = $6,
                avatar_media_id = $7, updated_at = $8
          WHERE id = $1`,
        [
          row.id,
          row.username,
          row.email,
          row.password_hash,
          row.full_name,
          row.bio,
          row.avatar_media_id,
          row.updated_at,
        ],
      );
    } catch (err) {
      throw translateUniqueViolation(err);
    }
  }

  async findById(id: UserId, tx?: Tx): Promise<User | null> {
    return this.findOne("id = $1", id, tx);
  }

  async findByUsername(u: Username, tx?: Tx): Promise<User | null> {
    return this.findOne("username = $1", u, tx);
  }

  /** Username or email, compared lowercased (both are stored lowercased). */
  async findByLogin(login: string, tx?: Tx): Promise<User | null> {
    return this.findOne("(username = $1 OR email = $1)", login.trim().toLowerCase(), tx);
  }

  async adjustCounters(id: UserId, delta: UserCounterDelta, tx: Tx): Promise<void> {
    await queryable(this.pool, tx).query(
      `UPDATE users
          SET posts_count = posts_count + $2,
              followers_count = followers_count + $3,
              following_count = following_count + $4
        WHERE id = $1`,
      [id, delta.posts ?? 0, delta.followers ?? 0, delta.following ?? 0],
    );
  }

  async getProfileView(username: Username, viewerId: UserId | null): Promise<UserProfileView | null> {
    const { rows } = await this.pool.query<UserProfileViewRow>(PROFILE_VIEW_SQL, [username, viewerId]);
    const row = rows[0];
    return row ? mapUserProfileViewRow(row) : null;
  }

  private async findOne(where: string, value: string, tx?: Tx): Promise<User | null> {
    const { rows } = await queryable(this.pool, tx).query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE ${where}`,
      [value],
    );
    const row = rows[0];
    return row ? mapUserRowToEntity(row) : null;
  }
}
