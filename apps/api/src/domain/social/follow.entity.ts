import type { UserId } from "../shared/ids.js";

/** `followerId !== followeeId` (`INV-01`). */
export type Follow = { followerId: UserId; followeeId: UserId; createdAt: Date };

/** Result of follow/unfollow with the followee's updated follower count. */
export type FollowState = { followeeId: UserId; following: boolean; followersCount: number };
