import { DomainError } from "../shared/errors.js";
import type { UserId } from "../shared/ids.js";

/** `followerId !== followeeId` (`INV-01`). */
export type Follow = { followerId: UserId; followeeId: UserId; createdAt: Date };

/** Result of follow/unfollow with the followee's updated follower count. */
export type FollowState = { followeeId: UserId; following: boolean; followersCount: number };

/** Entity factories for `ENT-Follow` (backend/01-business-entities.md#follow). */
export const Follow = {
  /** New follow relation created at `now`; `422 CANNOT_FOLLOW_SELF` when both ids are equal (`INV-01`). */
  create(followerId: UserId, followeeId: UserId, now: Date): Follow {
    if (followerId === followeeId) {
      throw new DomainError("CANNOT_FOLLOW_SELF", "You cannot follow yourself");
    }
    return { followerId, followeeId, createdAt: now };
  },
};

/** Entity factories for the `FollowState` read result. */
export const FollowState = {
  /** Snapshot after follow/unfollow; `followersCount` is the followee's count read in the same tx. */
  of(followeeId: UserId, following: boolean, followersCount: number): FollowState {
    if (!Number.isInteger(followersCount) || followersCount < 0) {
      throw new DomainError("INTERNAL", "followersCount must be a non-negative integer");
    }
    return { followeeId, following, followersCount };
  },
};
