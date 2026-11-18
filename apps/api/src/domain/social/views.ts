import type { UserRelationView, UserSummaryView } from "../identity/views.js";
import type { Page, TimeCursor } from "../shared/pagination.js";
import type { Follow } from "./follow.entity.js";

/** Followers / following list page (relation time = follow `created_at`). */
export type FollowListPage = Page<UserRelationView, TimeCursor>;

/** List item: a user summary plus the `created_at` of the follow that links it to the list owner. */
export function toFollowRelationView(user: UserSummaryView, follow: Follow): UserRelationView {
  return { ...user, relationAt: follow.createdAt };
}
