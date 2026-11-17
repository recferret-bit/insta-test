import type { FastifyInstance } from "fastify";

export type ReadinessResult = { db: "ok" | "down" };

export type HealthDeps = {
  /** DB round trip within 1 s and latest migration applied (`data/db/health.ts`, wired by main.ts). */
  readiness: () => Promise<ReadinessResult>;
  /** `GIT_SHA`. */
  version: string;
};

/**
 * Probes (`F-INFRA-07`, infra/02-env-ci-and-probes.md#health-probes): unauthenticated and not rate limited.
 * - `GET /healthz` → liveness `200 {"status":"ok"}`.
 * - `GET /api/v1/health` → readiness `200 {"status":"ok","db":"ok","version"}` or `503 {"status":"degraded","db":"down"}`.
 */
export function registerHealthRoutes(app: FastifyInstance, deps: HealthDeps): void {
  app.get("/healthz", { config: { auth: "none", rateLimit: false } }, async () => ({ status: "ok" }));

  app.get("/api/v1/health", { config: { auth: "none", rateLimit: false } }, async (_request, reply) => {
    const result = await deps.readiness();
    if (result.db === "ok") return reply.code(200).send({ status: "ok", db: "ok", version: deps.version });
    return reply.code(503).send({ status: "degraded", db: "down" });
  });
}
