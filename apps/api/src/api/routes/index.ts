import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { RouteDeps } from "../app-services.js";
import { commentsRoutes } from "./comments.routes.js";
import { eventsRoutes } from "./events.routes.js";
import { feedRoutes } from "./feed.routes.js";
import { identityRoutes } from "./identity.routes.js";
import { likesRoutes } from "./likes.routes.js";
import { mediaRoutes } from "./media.routes.js";
import { notificationsRoutes } from "./notifications.routes.js";
import { postsRoutes } from "./posts.routes.js";
import { searchRoutes } from "./search.routes.js";
import { socialRoutes } from "./social.routes.js";
import { storiesRoutes } from "./stories.routes.js";

/** Versioned API prefix; route modules use absolute paths (`${API_V1}/posts`) because `media` also serves `/media/*`. */
export const API_V1 = "/api/v1";

export type RouteModule = { name: string; plugin: FastifyPluginAsyncZod<RouteDeps> };

/**
 * Auto-discovery list (specs/01-project-structure.md#auto-discovery-extension-points):
 * `api/server.ts` registers every entry. Frozen in w00 — waves fill the plugin bodies only.
 */
export const routeModules: readonly RouteModule[] = [
  { name: "identity", plugin: identityRoutes },
  { name: "media", plugin: mediaRoutes },
  { name: "posts", plugin: postsRoutes },
  { name: "likes", plugin: likesRoutes },
  { name: "comments", plugin: commentsRoutes },
  { name: "social", plugin: socialRoutes },
  { name: "stories", plugin: storiesRoutes },
  { name: "feed", plugin: feedRoutes },
  { name: "search", plugin: searchRoutes },
  { name: "notifications", plugin: notificationsRoutes },
  { name: "events", plugin: eventsRoutes },
];
