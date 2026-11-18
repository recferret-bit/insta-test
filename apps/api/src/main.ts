import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

import type { FastifyInstance } from "fastify";
import type pg from "pg";

import type { ApiServices } from "./api/app-services.js";
import { buildServer } from "./api/server.js";
import { createSseHub, type SseHub } from "./api/sse/index.js";
import { createUrlBuilder } from "./api/url-builder.js";
import { loadEnv, type Env } from "./config/env.js";
import { Argon2PasswordHasher } from "./data/crypto/argon2-password-hasher.js";
import { RandomTokenGenerator } from "./data/crypto/token-generator.js";
import { UuidV7IdGenerator } from "./data/crypto/uuidv7-id-generator.js";
import { createDbReadinessCheck } from "./data/db/health.js";
import { InProcessEventBus } from "./data/db/in-process-event-bus.js";
import { latestMigrationVersion, runMigrations } from "./data/db/migrate.js";
import { createPool } from "./data/db/pool.js";
import { PgUnitOfWork } from "./data/db/tx.js";
import { PgCommentRepository } from "./data/repositories/comments.pg-repository.js";
import { PgFeedQueries } from "./data/repositories/feed.pg-repository.js";
import { PgFollowRepository } from "./data/repositories/follows.pg-repository.js";
import { PgLikeRepository } from "./data/repositories/likes.pg-repository.js";
import { PgMediaRepository } from "./data/repositories/media.pg-repository.js";
import { PgNotificationRepository } from "./data/repositories/notifications.pg-repository.js";
import { PgPostRepository } from "./data/repositories/posts.pg-repository.js";
import { PgSearchQueries } from "./data/repositories/search.pg-repository.js";
import { PgSessionRepository } from "./data/repositories/sessions.pg-repository.js";
import { PgStoryRepository } from "./data/repositories/stories.pg-repository.js";
import { PgUserRepository } from "./data/repositories/users.pg-repository.js";
import { LocalMediaProbe } from "./data/storage/media-probe.js";
import { LocalMediaStorage } from "./data/storage/local-media-storage.js";
import { FeedService } from "./domain/feed/feed.service.js";
import { IdentityService } from "./domain/identity/identity.service.js";
import type { PasswordHasher } from "./domain/identity/ports.js";
import { MediaService } from "./domain/media/media.service.js";
import { NotificationService } from "./domain/notifications/notification.service.js";
import { CommentService } from "./domain/posts/comment.service.js";
import { LikeService } from "./domain/posts/like.service.js";
import { PostService } from "./domain/posts/post.service.js";
import { SearchService } from "./domain/search/search.service.js";
import { SystemClock, type Clock } from "./domain/shared/clock.js";
import { FollowService } from "./domain/social/follow.service.js";
import { StoryService } from "./domain/stories/story.service.js";
import { createJobs, startJobs, type JobRunner } from "./jobs/index.js";

/**
 * Composition root (specs/01-project-structure.md): config → pool → repos → services → event bus →
 * SSE hub → server → jobs. The only module allowed to import every layer.
 */

export type AppOverrides = {
  clock?: Clock;
  passwordHasher?: PasswordHasher;
  /** Reuse an existing pool (tests); it is then not ended by `close()`. */
  pool?: pg.Pool;
  /** Default `true`; tests may disable. */
  rateLimit?: boolean;
};

export type App = {
  server: FastifyInstance;
  pool: pg.Pool;
  services: ApiServices;
  bus: InProcessEventBus;
  sse: SseHub;
  clock: Clock;
  /** Listen on `API_PORT`, then start jobs (when `JOBS_ENABLED`). */
  start(): Promise<void>;
  /** Graceful shutdown (infra/02-env-ci-and-probes.md#health-probes). */
  close(): Promise<void>;
};

const SHUTDOWN_GRACE_MS = 10_000;

export async function createApp(env: Env, overrides: AppOverrides = {}): Promise<App> {
  const ownsPool = overrides.pool === undefined;
  const pool = overrides.pool ?? createPool(env.DATABASE_URL);
  const clock = overrides.clock ?? new SystemClock();
  const ids = new UuidV7IdGenerator();

  // Logger is attached once the server exists; events are only published after requests start.
  const logRef: { current?: FastifyInstance["log"] } = {};
  const bus = new InProcessEventBus({ error: (obj, msg) => logRef.current?.error(obj, msg) });
  const uow = new PgUnitOfWork(pool, bus);

  const users = new PgUserRepository(pool);
  const sessions = new PgSessionRepository(pool);
  const media = new PgMediaRepository(pool);
  const posts = new PgPostRepository(pool);
  const likes = new PgLikeRepository(pool);
  const comments = new PgCommentRepository(pool);
  const follows = new PgFollowRepository(pool);
  const stories = new PgStoryRepository(pool);
  const notifications = new PgNotificationRepository(pool);
  const feedQueries = new PgFeedQueries(pool);
  const searchQueries = new PgSearchQueries(pool);

  const storage = new LocalMediaStorage(env.MEDIA_DIR);
  const probe = new LocalMediaProbe();

  const services: ApiServices = {
    identity: new IdentityService({
      users,
      sessions,
      media,
      passwordHasher: overrides.passwordHasher ?? new Argon2PasswordHasher(),
      tokens: new RandomTokenGenerator(),
      uow,
      clock,
      ids,
      sessionTtlDays: env.SESSION_TTL_DAYS,
    }),
    media: new MediaService({ media, storage, probe, clock, ids }),
    posts: new PostService({ posts, media, users, uow, clock, ids }),
    likes: new LikeService({ likes, posts, notifications, uow, clock, ids }),
    comments: new CommentService({ comments, posts, notifications, uow, clock, ids }),
    follows: new FollowService({ follows, users, notifications, uow, clock, ids }),
    stories: new StoryService({ stories, media, storage, users, uow, clock, ids }),
    feed: new FeedService({ feed: feedQueries }),
    search: new SearchService({ search: searchQueries, feed: feedQueries }),
    notifications: new NotificationService({ notifications, uow, clock }),
  };

  const sse = createSseHub({ now: () => clock.now() });
  bus.subscribe((event) => sse.handle(event));

  const expectedVersion = await latestMigrationVersion();
  const app = await buildServer({
    services,
    sse,
    urls: createUrlBuilder(env.PUBLIC_API_URL),
    health: { readiness: createDbReadinessCheck(pool, expectedVersion), version: env.GIT_SHA },
    corsOrigins: env.CORS_ORIGIN,
    mediaDir: storage.root,
    responseValidation: env.RESPONSE_VALIDATION,
    logLevel: env.LOG_LEVEL,
    rateLimit: overrides.rateLimit ?? true,
  });
  logRef.current = app.log;

  if (env.MIGRATE_ON_START) {
    const result = await runMigrations(pool, { logger: app.log });
    app.log.info({ applied: result.applied, latestVersion: result.latestVersion }, "migrations up to date");
  }

  const jobs = createJobs({ media, stories, storage, clock });
  let jobRunner: JobRunner | undefined;
  let closing: Promise<void> | undefined;

  return {
    server: app,
    pool,
    services,
    bus,
    sse,
    clock,
    async start() {
      await app.listen({ host: "0.0.0.0", port: env.API_PORT });
      jobRunner = startJobs(jobs, { pool, logger: app.log, enabled: env.JOBS_ENABLED });
    },
    close() {
      closing ??= (async () => {
        // Stop accepting connections and close SSE streams so they do not hold the server open.
        sse.closeAll();
        let timer: NodeJS.Timeout | undefined;
        const grace = new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            app.server.closeAllConnections?.();
            resolve();
          }, SHUTDOWN_GRACE_MS);
          timer.unref();
        });
        await Promise.race([app.close(), grace]);
        clearTimeout(timer);
        await jobRunner?.stop();
        if (ownsPool) await pool.end();
      })();
      return closing;
    },
  };
}

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await createApp(env);
  const shutdown = (signal: string) => {
    app.server.log.info({ signal }, "shutting down");
    app.close().then(
      () => process.exit(0),
      (err: unknown) => {
        app.server.log.error({ err }, "shutdown failed");
        process.exit(1);
      },
    );
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  await app.start();
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main().catch((err: unknown) => {
    process.stderr.write(
      `Fatal startup error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exit(1);
  });
}
