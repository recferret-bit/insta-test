import type { UserRelationView } from "../identity/views.js";
import type { Page, TimeCursor } from "../shared/pagination.js";

/** Followers / following list page (relation time = follow `created_at`). */
export type FollowListPage = Page<UserRelationView, TimeCursor>;
