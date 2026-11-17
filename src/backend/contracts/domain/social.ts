import type { UserSummaryView } from "./identity.ts";
import type { UserId } from "./shared/ids.ts";

/** ENT-Follow business entity (backend/01-business-entities.md#follow). */

export type Follow = { followerId: UserId; followeeId: UserId; createdAt: Date };
export type FollowState = { followeeId: UserId; following: boolean; followersCount: number };
export type FollowCommand = { followerId: UserId; followeeUsername: string };

/** Followers / following / likers list entry; `relationAt` → `followed_at` on the wire. */
export type UserRelationView = { user: UserSummaryView; relationAt: Date | null };
