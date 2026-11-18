import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { RouteDeps } from "../app-services.js";

/**
 * `stories` route module — w00 stub, filled by w04.
 * Endpoints: POST /stories, GET /stories/tray, GET /users/{username}/stories, POST /stories/{story_id}/seen, GET /stories/{story_id}/viewers, DELETE /stories/{story_id}.
 * Paths are absolute (prefix with `API_V1` from `./index.js`); each route declares
 * `schema` from `@insta/contracts` and `config: { auth, rateLimit? }` (backend/03 handler rules).
 */
export const storiesRoutes: FastifyPluginAsyncZod<RouteDeps> = async (app, deps) => {
  // Intentionally empty until w04.
};
