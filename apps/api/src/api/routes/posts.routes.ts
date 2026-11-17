import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { RouteDeps } from "../app-services.js";

/**
 * `posts` route module — w00 stub, filled by w02.
 * Endpoints: POST /posts, GET|PATCH|DELETE /posts/{post_id}, GET /users/{username}/posts.
 * Paths are absolute (prefix with `API_V1` from `./index.js`); each route declares
 * `schema` from `@insta/contracts` and `config: { auth, rateLimit? }` (backend/03 handler rules).
 */
export const postsRoutes: FastifyPluginAsyncZod<RouteDeps> = async (app, deps) => {
  // Intentionally empty until w02.
};
