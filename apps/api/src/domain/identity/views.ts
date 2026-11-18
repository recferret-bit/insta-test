import type { UserId } from "../shared/ids.js";
import type { Email, User, Username } from "./user.entity.js";

/** Compact user card used inside posts, comments, lists, notifications and search results. */
export type UserSummaryView = {
  id: UserId;
  username: Username;
  fullName: string;
  avatarStorageKey: string | null;
  /** `null` when anonymous or self. */
  viewerIsFollowing: boolean | null;
};

/** User summary plus relation time (follow / like `created_at`) for followers, following and likers lists. */
export type UserRelationView = UserSummaryView & { relationAt: Date };

export type UserProfileView = UserSummaryView & {
  bio: string;
  stats: User["stats"];
  hasActiveStory: boolean;
  createdAt: Date;
  /** Only populated for the viewer's own profile. */
  email?: Email;
};
