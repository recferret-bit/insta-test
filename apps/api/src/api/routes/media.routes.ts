import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { RouteDeps } from "../app-services.js";

/**
 * `media` route module — w00 stub, filled by w01.
 * Endpoints: POST /api/v1/media, GET /media/{storage_key} (static, outside /api/v1).
 * Paths are absolute (prefix with `API_V1` from `./index.js`); each route declares
 * `schema` from `@insta/contracts` and `config: { auth, rateLimit? }` (backend/03 handler rules).
 */
export const mediaRoutes: FastifyPluginAsyncZod<RouteDeps> = async (app, deps) => {
  // Intentionally empty until w01.
};
