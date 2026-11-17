import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { RouteDeps } from "../app-services.js";

/**
 * `events` route module — w00 stub, filled by w06.
 * Endpoints: POST /events/ticket, GET /events/stream (SSE via `deps.sse`).
 * Paths are absolute (prefix with `API_V1` from `./index.js`); each route declares
 * `schema` from `@insta/contracts` and `config: { auth, rateLimit? }` (backend/03 handler rules).
 */
export const eventsRoutes: FastifyPluginAsyncZod<RouteDeps> = async (app, deps) => {
  // Intentionally empty until w06.
};
