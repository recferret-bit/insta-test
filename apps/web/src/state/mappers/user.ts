/**
 * User ViewModels & mappers — `UserSummaryViewModel`, `ProfileViewModel`, `MeViewModel` plus the identity form
 * mappers (frontend/02-state-viewmodels-and-mappers.md). Owned by w01 after w00.
 */
import type { MeResponseDto, UserProfileResponseDto, UserSummaryDto } from "@insta/contracts";

import type { LoginBody, SignupBody } from "../../api/auth";
import type { UpdateProfileBody } from "../../api/users";
import { formatCompactCount, formatCompactNumber, initialsAvatarUrl } from "./format";

export type UserSummaryViewModel = {
  id: string;
  username: string;
  fullName: string;
  /** `fullName` when set, else `username`. */
  displayName: string;
  /** Uploaded avatar, or a generated initials avatar (`data:` URL). */
  avatarUrl: string;
  hasCustomAvatar: boolean;
  /** `null` when anonymous or self. */
  isFollowing: boolean | null;
  profilePath: string;
};

export type ProfileCountsLabel = { posts: string; followers: string; following: string };

export type ProfileViewModel = {
  id: string;
  username: string;
  fullName: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  hasCustomAvatar: boolean;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  /** Compact counters (`"1.2K"`) for the profile header. */
  countsLabel: ProfileCountsLabel;
  /** Accessible long form, e.g. `"12 posts, 1.2K followers, 80 following"`. */
  countsSummary: string;
  isFollowing: boolean | null;
  hasActiveStory: boolean;
  isSelf: boolean;
  profilePath: string;
  createdAt: string;
};

export type MeViewModel = ProfileViewModel & { email: string };

export function profilePathFor(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

function avatarFields(username: string, fullName: string, avatarUrl: string | null) {
  return {
    avatarUrl: avatarUrl ?? initialsAvatarUrl(username, fullName),
    hasCustomAvatar: avatarUrl !== null,
  };
}

export function toUserSummaryVM(dto: UserSummaryDto): UserSummaryViewModel {
  return {
    id: dto.id,
    username: dto.username,
    fullName: dto.full_name,
    displayName: dto.full_name.trim() || dto.username,
    ...avatarFields(dto.username, dto.full_name, dto.avatar_url),
    isFollowing: dto.is_following,
    profilePath: profilePathFor(dto.username),
  };
}

/** Recomputes the counter labels after an optimistic counter change. */
export function withProfileCounts(
  vm: ProfileViewModel,
  counts: Partial<Pick<ProfileViewModel, "postsCount" | "followersCount" | "followingCount">>,
): ProfileViewModel {
  const postsCount = counts.postsCount ?? vm.postsCount;
  const followersCount = counts.followersCount ?? vm.followersCount;
  const followingCount = counts.followingCount ?? vm.followingCount;
  return {
    ...vm,
    postsCount,
    followersCount,
    followingCount,
    countsLabel: {
      posts: formatCompactNumber(postsCount),
      followers: formatCompactNumber(followersCount),
      following: formatCompactNumber(followingCount),
    },
    countsSummary: [
      formatCompactCount(postsCount, "post"),
      formatCompactCount(followersCount, "follower"),
      `${formatCompactNumber(followingCount)} following`,
    ].join(", "),
  };
}

/** `viewerId` = `usr_…` of the signed-in user, or `null` when anonymous. */
export function toProfileVM(dto: UserProfileResponseDto, viewerId: string | null): ProfileViewModel {
  const base: ProfileViewModel = {
    id: dto.id,
    username: dto.username,
    fullName: dto.full_name,
    displayName: dto.full_name.trim() || dto.username,
    bio: dto.bio,
    ...avatarFields(dto.username, dto.full_name, dto.avatar_url),
    postsCount: dto.posts_count,
    followersCount: dto.followers_count,
    followingCount: dto.following_count,
    countsLabel: { posts: "", followers: "", following: "" },
    countsSummary: "",
    isFollowing: dto.is_following,
    hasActiveStory: dto.has_active_story,
    isSelf: viewerId !== null && viewerId === dto.id,
    profilePath: profilePathFor(dto.username),
    createdAt: dto.created_at,
  };
  return withProfileCounts(base, {});
}

export function toMeVM(dto: MeResponseDto): MeViewModel {
  return { ...toProfileVM(dto, dto.id), email: dto.email };
}

// ---- form → Request DTO ----

export type SignupForm = { username: string; email: string; password: string; fullName: string };
export type LoginForm = { login: string; password: string };
export type EditProfileForm = {
  username: string;
  fullName: string;
  bio: string;
  /** `undefined` = unchanged, `null` = remove avatar, `med_…` = newly uploaded avatar. */
  avatarMediaId?: string | null;
};

export function toSignupDto(form: SignupForm): SignupBody {
  return {
    username: form.username.trim().toLowerCase(),
    email: form.email.trim(),
    password: form.password,
    full_name: form.fullName.trim(),
  };
}

export function toLoginDto(form: LoginForm): LoginBody {
  return { login: form.login.trim(), password: form.password };
}

/** Only changed fields; `null` when nothing changed (the API rejects an empty `PATCH /me`). */
export function toUpdateProfileDto(
  form: EditProfileForm,
  original: ProfileViewModel,
): UpdateProfileBody | null {
  const body: UpdateProfileBody = {};
  const username = form.username.trim().toLowerCase();
  if (username !== original.username) body.username = username;
  const fullName = form.fullName.trim();
  if (fullName !== original.fullName) body.full_name = fullName;
  if (form.bio !== original.bio) body.bio = form.bio;
  if (form.avatarMediaId !== undefined) {
    if (form.avatarMediaId !== null || original.hasCustomAvatar) body.avatar_media_id = form.avatarMediaId;
  }
  return Object.keys(body).length > 0 ? body : null;
}
