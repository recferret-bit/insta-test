/**
 * Dev seed data (`npm run seed -w apps/api`, needs `DATABASE_URL`). Never runs in CI or previews
 * (persistence/02-migrations-and-indexes.md). Idempotent: existing usernames are left untouched.
 * Users: alice, bob, carol — password `password123`. bob and carol follow alice.
 */
import { Argon2PasswordHasher } from "../src/data/crypto/argon2-password-hasher.js";
import { UuidV7IdGenerator } from "../src/data/crypto/uuidv7-id-generator.js";
import { runMigrations } from "../src/data/db/migrate.js";
import { createPool } from "../src/data/db/pool.js";

const DEMO_PASSWORD = "password123";
const USERS = [
  { username: "alice", fullName: "Alice Liddell", bio: "Down the rabbit hole 🐇" },
  { username: "bob", fullName: "Bob Builder", bio: "Can we fix it?" },
  { username: "carol", fullName: "Carol Danvers", bio: "" },
];

async function seed(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = createPool(url, { max: 2, applicationName: "insta-seed" });
  const ids = new UuidV7IdGenerator();
  const hasher = new Argon2PasswordHasher();
  try {
    await runMigrations(pool);
    const hash = await hasher.hash(DEMO_PASSWORD);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const u of USERS) {
        await client.query(
          `INSERT INTO users (id, username, email, password_hash, full_name, bio)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (username) DO NOTHING`,
          [ids.uuidv7(), u.username, `${u.username}@example.test`, hash, u.fullName, u.bio],
        );
      }
      const inserted = await client.query(
        `INSERT INTO follows (follower_id, followee_id)
         SELECT f.id, a.id FROM users f, users a
          WHERE a.username = 'alice' AND f.username IN ('bob', 'carol')
         ON CONFLICT DO NOTHING`,
      );
      if ((inserted.rowCount ?? 0) > 0) {
        await client.query(
          `UPDATE users u SET
             followers_count = (SELECT count(*) FROM follows WHERE followee_id = u.id),
             following_count = (SELECT count(*) FROM follows WHERE follower_id = u.id)
           WHERE u.username IN ('alice', 'bob', 'carol')`,
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    process.stdout.write(
      `seeded users: ${USERS.map((u) => u.username).join(", ")} (password: ${DEMO_PASSWORD})\n`,
    );
  } finally {
    await pool.end();
  }
}

seed().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
