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

/** Viewer-dependent inputs for building a view from a loaded `User`. */
export type UserViewContext = {
  /** Storage key of `user.avatarMediaId` (joined from `media_assets`), or `null`. */
  avatarStorageKey: string | null;
  /** Signed-in viewer, or `null` when anonymous. */
  viewerId: UserId | null;
  /** Ignored (forced to `null`) when anonymous or self. */
  viewerIsFollowing: boolean | null;
};

function viewerFollowState(user: User, ctx: UserViewContext): boolean | null {
  return ctx.viewerId === null || ctx.viewerId === user.id ? null : ctx.viewerIsFollowing;
}

/** `User` → `UserSummaryView` (no email, viewer flag `null` for anonymous/self). */
export function toUserSummaryView(user: User, ctx: UserViewContext): UserSummaryView {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    avatarStorageKey: ctx.avatarStorageKey,
    viewerIsFollowing: viewerFollowState(user, ctx),
  };
}

/** `User` → `UserProfileView`; `email` is set only when the viewer is the user (own profile / `GET /me`). */
export function toUserProfileView(
  user: User,
  ctx: UserViewContext & { hasActiveStory: boolean },
): UserProfileView {
  const view: UserProfileView = {
    ...toUserSummaryView(user, ctx),
    bio: user.bio,
    stats: { ...user.stats },
    hasActiveStory: ctx.hasActiveStory,
    createdAt: user.createdAt,
  };
  if (ctx.viewerId === user.id) view.email = user.email;
  return view;
}
